'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScanSortie } from '@/lib/scan';
import { Btn, Carte, Message, Spinner, Vide, cx } from '@/components/ui';
import { Marque } from '@/components/Marque';
import Lecteur from '@/components/controleur/Lecteur';
import Recherche from '@/components/controleur/Recherche';
import ResultatPlein, { type Affiche } from '@/components/controleur/ResultatPlein';
import { api, deconnecter, ErreurApi } from '@/lib/client';
import {
  ajouterFile, enregistrerListe, etudiantParId, etudiantParJeton, listerFile, lireMeta, retirerDeFile,
  type DonneesListe, type EntreeFile,
} from '@/lib/offline';
import {
  evaluer, formatDateHeure, formatHeure, jetonDepuisQr, RESULTAT_LABEL, TYPE_LABEL,
  type Regle, type Resultat, type TypePassage,
} from '@/lib/shared';

type Liste = { cars: { id: number; nom: string }[]; regle: Regle; nb: number; le: string };
type LigneJour = {
  cle: string; id?: number; client_uid: string; horodatage: string; type: TypePassage; resultat: Resultat;
  nom: string; matricule?: string | null; detail?: string | null; doublon: boolean; enAttente: boolean;
};
type Entree = { jeton?: string; etudiant_id?: number; nom_saisi?: string };

const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `u${Date.now()}${Math.random().toString(36).slice(2, 10)}`);
const POINT: Record<Resultat, string> = { en_regle: 'bg-ok', a_verifier: 'bg-alerte', non_solde: 'bg-danger', non_inscrit: 'bg-danger', invalide: 'bg-danger', desactive: 'bg-danger' };

export default function Controleur() {
  const [liste, setListe] = useState<Liste | null>(null);
  const [carId, setCarId] = useState<number | null>(null);
  const [type, setType] = useState<TypePassage>('montee');
  const [ecran, setEcran] = useState<'prepa' | 'scan'>('prepa');
  const [enLigne, setEnLigne] = useState(true);
  const [attente, setAttente] = useState(0);
  const [jour, setJour] = useState<LigneJour[]>([]);
  const [affiche, setAffiche] = useState<Affiche | null>(null);
  const [recherche, setRecherche] = useState(false);
  const [msg, setMsg] = useState<{ type: 'erreur' | 'attention' | 'succes'; texte: string } | null>(null);
  const [telechargement, setTelechargement] = useState(false);
  const [synchro, setSynchro] = useState(false);
  const [confirmer, setConfirmer] = useState<string | null>(null);

  const verrou = useRef(false);
  const recents = useRef(new Map<string, number>());
  const serveurJour = useRef<any[]>([]);
  const enSynchro = useRef(false);

  const nomCar = useCallback((id: number | null) => liste?.cars.find((c) => c.id === id)?.nom ?? '—', [liste]);

  /* ---------- liste hors-ligne ---------- */
  const telecharger = useCallback(async (silencieux = false) => {
    setTelechargement(true);
    try {
      const d = await api<DonneesListe>('/api/controleur/donnees', { delai: 30000 });
      await enregistrerListe(d);
      setListe({ cars: d.cars, regle: d.regle, nb: d.etudiants.length, le: d.telecharge_le });
      setCarId((c) => (c && d.cars.some((x) => x.id === c) ? c : null));
      if (!silencieux) setMsg({ type: 'succes', texte: `Liste à jour : ${d.etudiants.length} étudiants.` });
    } catch (e) {
      if (!silencieux) setMsg({ type: 'erreur', texte: (e as ErreurApi).message });
    }
    setTelechargement(false);
  }, []);

  /* ---------- scans du jour (serveur + file d'attente locale) ---------- */
  const rafraichirJour = useCallback(async () => {
    const file = await listerFile().catch(() => [] as EntreeFile[]);
    setAttente(file.length);
    if (navigator.onLine) {
      try { serveurJour.current = (await api<{ scans: any[] }>('/api/controleur/scans', { delai: 6000 })).scans; } catch { /* garde la dernière liste */ }
    }
    const enFile = new Set(file.map((f) => f.client_uid));
    const l1: LigneJour[] = file.map((f) => ({
      cle: f.client_uid, client_uid: f.client_uid, horodatage: f.horodatage, type: f.type, resultat: f.resultat,
      nom: f.nom, matricule: f.matricule, detail: f.detail, doublon: f.doublon, enAttente: true,
    }));
    const l2: LigneJour[] = serveurJour.current
      .filter((s) => !enFile.has(s.client_uid))
      .map((s) => ({
        cle: `s${s.id}`, id: Number(s.id), client_uid: s.client_uid ?? '', horodatage: s.horodatage, type: s.type, resultat: s.resultat,
        nom: s.etudiant ?? s.nom_saisi ?? 'QR non reconnu', matricule: s.matricule, detail: s.detail, doublon: s.doublon, enAttente: false,
      }));
    setJour([...l1, ...l2].sort((a, b) => b.horodatage.localeCompare(a.horodatage)).slice(0, 60));
  }, []);

  /* ---------- synchronisation ---------- */
  const synchroniser = useCallback(async (manuel = false) => {
    if (enSynchro.current || !navigator.onLine) return;
    const file = await listerFile().catch(() => [] as EntreeFile[]);
    if (file.length === 0) { if (manuel) setMsg({ type: 'succes', texte: 'Tout est déjà synchronisé.' }); return; }
    enSynchro.current = true;
    setSynchro(true);
    try {
      for (let i = 0; i < file.length; i += 100) {
        const lot = file.slice(i, i + 100);
        const r = await api<{ resultats: ScanSortie[] }>('/api/controleur/sync', {
          delai: 25000,
          corps: {
            scans: lot.map((f) => ({
              jeton: f.jeton, etudiant_id: f.etudiant_id, nom_saisi: f.nom_saisi,
              car_id: f.car_id, type: f.type, client_uid: f.client_uid, horodatage: f.horodatage,
            })),
          },
        });
        await retirerDeFile(r.resultats.map((x) => x.client_uid));
      }
      if (manuel) setMsg({ type: 'succes', texte: `${file.length} scan(s) synchronisé(s).` });
    } catch (e) {
      if ((e as ErreurApi).code !== 'reseau') setMsg({ type: 'erreur', texte: `Synchronisation impossible : ${(e as ErreurApi).message}` });
    }
    enSynchro.current = false;
    setSynchro(false);
    rafraichirJour();
  }, [rafraichirJour]);

  /* ---------- démarrage ---------- */
  useEffect(() => {
    setEnLigne(navigator.onLine);
    (async () => {
      try {
        const [cars, regle, info] = await Promise.all([
          lireMeta<Liste['cars']>('cars'), lireMeta<Regle>('regle'), lireMeta<{ nb: number; telecharge_le: string }>('info'),
        ]);
        if (cars && regle && info) setListe({ cars, regle, nb: info.nb, le: info.telecharge_le });
      } catch { /* IndexedDB indisponible */ }
      try {
        const s = JSON.parse(localStorage.getItem('cc_setup') ?? 'null');
        if (s?.carId) setCarId(s.carId);
        if (s?.type === 'descente') setType('descente');
      } catch { /* ignore */ }
      if (navigator.onLine) await telecharger(true);
      await rafraichirJour();
      synchroniser();
    })();
    const on = () => { setEnLigne(true); synchroniser(); rafraichirJour(); };
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => { if (navigator.onLine) synchroniser(); }, 20000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (carId !== null) localStorage.setItem('cc_setup', JSON.stringify({ carId, type }));
  }, [carId, type]);

  /* ---------- enregistrement d'un scan ---------- */
  const fermer = useCallback(() => { verrou.current = false; setAffiche(null); }, []);

  async function scanLocal(base: Entree & { car_id: number; type: TypePassage; client_uid: string }) {
    if (!liste) {
      setMsg({ type: 'erreur', texte: 'Pas de réseau et la liste des étudiants n’a jamais été téléchargée.' });
      verrou.current = false;
      return;
    }
    let etu: Awaited<ReturnType<typeof etudiantParId>>;
    let resultat: Resultat;
    let detail: string;
    if (base.nom_saisi) {
      resultat = 'non_inscrit'; detail = 'Personne absente de la liste';
    } else {
      if (base.jeton) { const j = jetonDepuisQr(base.jeton); etu = j ? await etudiantParJeton(j) : undefined; }
      else etu = await etudiantParId(base.etudiant_id!);
      if (!etu) { resultat = 'invalide'; detail = 'QR inconnu ou étudiant non listé'; }
      else ({ resultat, detail } = evaluer(etu, base.car_id, liste.regle, nomCar));
    }
    let doublon = false;
    if (etu) {
      const cle = `${etu.id}:${base.type}`;
      const dernier = recents.current.get(cle);
      doublon = !!dernier && Date.now() - dernier < 60000;
      recents.current.set(cle, Date.now());
    }
    const nom = etu?.nom ?? base.nom_saisi ?? 'QR non reconnu';
    await ajouterFile({
      ...base, horodatage: new Date().toISOString(), resultat, detail, doublon, nom, matricule: etu?.matricule,
    });
    setAffiche({
      resultat, detail, doublon, nom, matricule: etu?.matricule, car: etu ? (etu.car_id ? nomCar(etu.car_id) : null) : undefined,
      solde: etu?.solde, horsLigne: true,
    });
    rafraichirJour();
  }

  async function traiter(entree: Entree) {
    if (carId === null) { verrou.current = false; return; }
    setMsg(null);
    const base = { ...entree, car_id: carId, type, client_uid: uid() };
    if (navigator.onLine) {
      try {
        const s = await api<ScanSortie>('/api/controleur/scan', { corps: base, delai: 7000 });
        if (s.etudiant) recents.current.set(`${s.etudiant.id}:${type}`, Date.now());
        setAffiche({
          resultat: s.resultat, detail: s.detail, doublon: s.doublon,
          nom: s.etudiant?.nom ?? entree.nom_saisi ?? 'QR non reconnu', matricule: s.etudiant?.matricule,
          car: s.etudiant ? s.etudiant.car : undefined, solde: s.etudiant?.solde, horsLigne: false,
        });
        rafraichirJour();
        return;
      } catch (e) {
        if ((e as ErreurApi).code !== 'reseau') {
          setMsg({ type: 'erreur', texte: (e as ErreurApi).message });
          verrou.current = false;
          return;
        }
      }
    }
    await scanLocal(base);
  }

  const surCode = (texte: string) => {
    if (verrou.current) return;
    verrou.current = true;
    traiter({ jeton: texte });
  };

  function depuisRecherche(e: Entree) {
    setRecherche(false);
    verrou.current = true;
    traiter(e);
  }

  async function annuler(l: LigneJour) {
    setConfirmer(null);
    try {
      if (l.enAttente) await retirerDeFile([l.client_uid]);
      else if (l.id) await api('/api/controleur/annuler', { corps: { id: l.id } });
      await rafraichirJour();
    } catch (e) {
      setMsg({ type: 'erreur', texte: (e as ErreurApi).message });
    }
  }

  /* ---------- rendu ---------- */
  const carNom = carId !== null ? nomCar(carId) : '';

  if (ecran === 'prepa') {
    return (
      <main className="mx-auto max-w-md pb-12">
        <header className="flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <Marque />
          <button onClick={deconnecter} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-encre-2 underline underline-offset-4">Déconnexion</button>
        </header>
        <div className="space-y-6 px-5">
          <h1 className="font-display text-3xl font-extrabold">Avant de partir</h1>

          <Carte className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">Liste des étudiants</p>
                {liste ? (
                  <p className="mt-0.5 text-[15px] text-encre-2">{liste.nb} étudiants · téléchargée le {formatDateHeure(liste.le)}</p>
                ) : (
                  <p className="mt-0.5 text-[15px] font-medium text-danger">Pas encore téléchargée.</p>
                )}
                <p className={cx('mt-1 text-sm font-semibold', enLigne ? 'text-ok' : 'text-alerte-texte')}>{enLigne ? 'En ligne' : 'Hors-ligne'}</p>
              </div>
              <Btn variante="contour" onClick={() => telecharger(false)} chargement={telechargement} disabled={!enLigne}>
                {liste ? 'Mettre à jour' : 'Télécharger'}
              </Btn>
            </div>
            <p className="mt-3 text-sm text-encre-2">Téléchargez la liste avant le trajet : elle permet de scanner même sans réseau.</p>
          </Carte>

          {msg && <Message type={msg.type}>{msg.texte}</Message>}
          {attente > 0 && (
            <Message type="attention">
              {attente} scan(s) en attente de synchronisation.{' '}
              <button className="font-bold underline" onClick={() => synchroniser(true)}>Synchroniser</button>
            </Message>
          )}

          <section>
            <h2 className="mb-2 font-semibold">Quel car ?</h2>
            {!liste || liste.cars.length === 0 ? (
              <Message type="info">Aucun car disponible. Téléchargez la liste (l’administrateur doit d’abord importer les fiches).</Message>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {liste.cars.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCarId(c.id)}
                    aria-pressed={carId === c.id}
                    className={cx(
                      'min-h-16 rounded-xl border-2 px-2 text-lg font-extrabold',
                      carId === c.id ? 'border-encre bg-car' : 'border-trait bg-surface',
                    )}
                  >
                    {c.nom}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 font-semibold">Type de scan</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['montee', 'descente'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={cx('min-h-16 rounded-xl border-2 text-xl font-extrabold', type === t ? 'border-encre bg-encre text-white' : 'border-trait bg-surface')}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </section>

          <Btn variante="jaune" grand className="w-full" disabled={carId === null} onClick={() => { setMsg(null); setEcran('scan'); }}>
            Commencer le contrôle
          </Btn>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md pb-10">
      <div className="sticky top-0 z-30 bg-encre px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-2xl font-extrabold">{carNom}</span>
            <span className="rounded-full bg-car px-3 py-0.5 text-sm font-bold text-encre">{TYPE_LABEL[type]}</span>
          </div>
          <button onClick={() => setEcran('prepa')} className="min-h-11 rounded-lg px-2 font-semibold underline underline-offset-4">Changer</button>
        </div>
        {(!enLigne || attente > 0) && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-alerte px-3 py-2 text-sm font-bold text-encre">
            <span>{!enLigne ? 'Hors-ligne' : 'En ligne'}{attente > 0 ? ` · ${attente} en attente` : ''}</span>
            {attente > 0 && enLigne && (
              <button onClick={() => synchroniser(true)} className="flex items-center gap-1.5 underline">{synchro && <Spinner className="size-4" />} Synchroniser</button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 px-4 pt-4">
        <Lecteur onCode={surCode} />
        {msg && <Message type={msg.type}>{msg.texte}</Message>}
        <Btn variante="contour" grand className="w-full" onClick={() => setRecherche(true)}>Recherche manuelle</Btn>

        <Carte>
          <h2 className="px-4 pt-4 font-display text-lg font-extrabold">Mes scans du jour</h2>
          {jour.length === 0 ? (
            <Vide>Aucun scan pour le moment.</Vide>
          ) : (
            <ul className="mt-2 divide-y divide-trait">
              {jour.map((l) => (
                <li key={l.cle} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cx('size-3.5 shrink-0 rounded-full', POINT[l.resultat])} title={RESULTAT_LABEL[l.resultat]} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{l.nom}</p>
                    <p className="truncate text-sm text-encre-2">
                      {RESULTAT_LABEL[l.resultat]} · {TYPE_LABEL[l.type]}{l.doublon ? ' · doublon' : ''}{l.enAttente ? ' · en attente' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="nombres text-sm font-semibold">{formatHeure(l.horodatage)}</p>
                    {confirmer === l.cle ? (
                      <button onClick={() => annuler(l)} className="min-h-9 text-sm font-bold text-danger underline">Confirmer</button>
                    ) : (
                      <button onClick={() => setConfirmer(l.cle)} className="min-h-9 text-sm font-semibold text-encre-2 underline">Annuler</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      {recherche && (
        <Recherche
          nomCar={nomCar}
          onChoisir={(id) => depuisRecherche({ etudiant_id: id })}
          onNonInscrit={(nom) => depuisRecherche({ nom_saisi: nom })}
          onFermer={() => setRecherche(false)}
        />
      )}
      {affiche && <ResultatPlein a={affiche} onFermer={fermer} />}
    </main>
  );
}
