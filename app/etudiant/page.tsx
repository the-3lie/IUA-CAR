'use client';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Btn, Carte, Champ, Chargement, Message, PastilleStatut, Vide } from '@/components/ui';
import { Marque } from '@/components/Marque';
import { api, deconnecter, ErreurApi } from '@/lib/client';
import { fcfa, formatDate, formatDateHeure, formatHeure, TYPE_LABEL, type Statut } from '@/lib/shared';

type Passage = { id: number; horodatage: string; type: 'montee' | 'descente'; resultat: string; car: string | null; controleur: string | null };
type Moi = {
  matricule: string; nom: string; car: string | null; statut: Statut; statut_label: string;
  montant_du: number; total_paye: number; solde: number; modalites: string | null;
  qr: string; historique: Passage[]; maj: string;
};
const CLE = 'cc_moi';

export default function EspaceEtudiant() {
  const [moi, setMoi] = useState<Moi | null>(null);
  const [horsLigne, setHorsLigne] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [plein, setPlein] = useState(false);

  const charger = useCallback(async () => {
    try {
      const d = await api<Moi>('/api/etudiant/moi', { delai: 12000 });
      setMoi(d);
      setHorsLigne(false);
      setErreur(null);
      localStorage.setItem(CLE, JSON.stringify(d));
    } catch (e) {
      if ((e as ErreurApi).code === 'reseau') setHorsLigne(true);
      else setErreur((e as ErreurApi).message);
    }
  }, []);

  useEffect(() => {
    try {
      const c = localStorage.getItem(CLE);
      if (c) setMoi(JSON.parse(c));
    } catch { /* cache illisible */ }
    charger();
    const rafraichir = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', rafraichir);
    window.addEventListener('online', charger);
    const t = setInterval(rafraichir, 60000);
    return () => { document.removeEventListener('visibilitychange', rafraichir); window.removeEventListener('online', charger); clearInterval(t); };
  }, [charger]);

  const jours = useMemo(() => {
    const g = new Map<string, Passage[]>();
    (moi?.historique ?? []).forEach((p) => {
      const j = formatDate(p.horodatage);
      g.set(j, [...(g.get(j) ?? []), p]);
    });
    return [...g];
  }, [moi]);

  if (!moi) {
    return (
      <main className="mx-auto max-w-md px-5 pt-10">
        {erreur ? <Message>{erreur}</Message> : horsLigne ? <Message type="attention">Hors-ligne et aucune donnée enregistrée sur cet appareil. Connectez-vous au réseau une première fois.</Message> : <Chargement />}
      </main>
    );
  }

  const ratio = moi.montant_du > 0 ? Math.min(100, Math.round((moi.total_paye / moi.montant_du) * 100)) : 0;
  const couleurBarre = moi.statut === 'en_regle' ? 'bg-ok' : moi.statut === 'solde_a_payer' ? 'bg-alerte' : 'bg-danger';

  return (
    <main className="mx-auto max-w-md pb-16">
      <header className="flex items-center justify-between px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Marque />
        <button onClick={deconnecter} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-encre-2 underline underline-offset-4">Déconnexion</button>
      </header>

      {horsLigne && (
        <div className="px-5 pb-3"><Message type="attention">Hors-ligne. Données du {formatDateHeure(moi.maj)} — votre QR reste valable.</Message></div>
      )}

      {/* Titre de transport */}
      <div className="px-5">
        <div className="relative rounded-3xl border-2 border-encre bg-surface shadow-[5px_5px_0_0_var(--color-encre)]">
          <div className="livree h-2.5 rounded-t-[20px]" />
          <div className="flex items-start justify-between gap-3 px-5 pt-4">
            <div>
              <p className="text-sm font-semibold text-encre-2">Car attribué</p>
              <p className="font-display text-5xl font-extrabold leading-none">{moi.car ?? 'Aucun'}</p>
            </div>
            <PastilleStatut statut={moi.statut} className="mt-1" />
          </div>
          <div className="px-5 pb-4 pt-3">
            <p className="text-lg font-bold leading-tight">{moi.nom}</p>
            <p className="nombres text-encre-2">Matricule {moi.matricule}</p>
          </div>

          <div className="relative">
            <span className="absolute -left-[13px] -top-3 size-6 rounded-full border-2 border-encre bg-fond [clip-path:inset(0_0_0_50%)]" />
            <span className="absolute -right-[13px] -top-3 size-6 rounded-full border-2 border-encre bg-fond [clip-path:inset(0_50%_0_0)]" />
            <div className="mx-5 border-t-2 border-dashed border-trait" />
          </div>

          <div className="px-5 pb-5 pt-4">
            <button onClick={() => setPlein(true)} aria-label="Agrandir le QR code" className="block w-full rounded-2xl border border-trait bg-white p-3">
              <QRCodeSVG value={moi.qr} size={256} level="M" style={{ width: '100%', height: 'auto' }} />
            </button>
            <p className="mt-3 text-center text-sm text-encre-2">Présentez ce code au contrôleur à chaque montée. Touchez-le pour l’agrandir.</p>
          </div>
        </div>
      </div>

      {/* Paiement */}
      <Carte className="mx-5 mt-6 p-5">
        <h2 className="font-display text-xl font-extrabold">Mon paiement</h2>
        <dl className="mt-3 space-y-2">
          <Ligne k="Montant total dû" v={fcfa(moi.montant_du)} />
          <Ligne k="Déjà payé" v={fcfa(moi.total_paye)} />
          <Ligne k="Solde restant" v={fcfa(moi.solde)} fort />
        </dl>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-trait/70" role="img" aria-label={`${ratio} % payé`}>
          <div className={`h-full rounded-full ${couleurBarre}`} style={{ width: `${ratio}%` }} />
        </div>
        <p className="mt-1.5 text-sm text-encre-2">{ratio} % payé</p>
        {moi.modalites && (
          <div className="mt-4 border-t border-trait pt-4">
            <h3 className="font-semibold">Modalités de paiement</h3>
            <p className="mt-1 whitespace-pre-line text-[15px] text-encre-2">{moi.modalites}</p>
          </div>
        )}
      </Carte>

      {/* Historique */}
      <Carte className="mx-5 mt-6">
        <h2 className="px-5 pt-5 font-display text-xl font-extrabold">Mes passages</h2>
        {jours.length === 0 ? (
          <Vide>Aucun passage pour le moment. Votre première montée apparaîtra ici.</Vide>
        ) : (
          jours.map(([jour, liste]) => (
            <div key={jour} className="mt-3">
              <p className="bg-fond px-5 py-1.5 text-sm font-semibold capitalize text-encre-2">{jour}</p>
              <ul className="divide-y divide-trait">
                {liste.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-full ${p.type === 'montee' ? 'bg-car' : 'bg-encre text-white'}`} aria-hidden>
                      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        {p.type === 'montee' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{TYPE_LABEL[p.type]}{p.car ? ` · ${p.car}` : ''}</p>
                      <p className="truncate text-sm text-encre-2">Scanné par {p.controleur ?? 'un contrôleur'}</p>
                    </div>
                    <p className="nombres font-semibold">{formatHeure(p.horodatage)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </Carte>

      <ChangerMotDePasse />

      {plein && (
        <div role="dialog" aria-modal="true" aria-label="QR code" className="apparition fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6">
          <p className="text-center text-lg font-bold">{moi.nom}<br /><span className="nombres font-medium text-encre-2">{moi.matricule} · {moi.car ?? 'Aucun car'}</span></p>
          <QRCodeSVG value={moi.qr} size={512} level="M" style={{ width: 'min(88vw, 70vh)', height: 'auto' }} />
          <Btn variante="primaire" grand onClick={() => setPlein(false)}>Fermer</Btn>
        </div>
      )}
    </main>
  );
}

function Ligne({ k, v, fort }: { k: string; v: string; fort?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-encre-2">{k}</dt>
      <dd className={`nombres ${fort ? 'text-xl font-extrabold' : 'font-semibold'}`}>{v}</dd>
    </div>
  );
}

function ChangerMotDePasse() {
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [etat, setEtat] = useState<{ type: 'erreur' | 'succes'; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEtat(null);
    setEnvoi(true);
    try {
      await api('/api/etudiant/mot-de-passe', { corps: { actuel, nouveau } });
      setEtat({ type: 'succes', texte: 'Mot de passe modifié.' });
      setActuel(''); setNouveau('');
    } catch (err) {
      setEtat({ type: 'erreur', texte: (err as ErreurApi).message });
    }
    setEnvoi(false);
  }

  return (
    <details className="mx-5 mt-6 rounded-2xl border border-trait bg-surface">
      <summary className="flex min-h-14 cursor-pointer items-center px-5 font-semibold">Changer mon mot de passe</summary>
      <form onSubmit={soumettre} className="space-y-4 border-t border-trait p-5">
        <Champ label="Mot de passe actuel" type="password" value={actuel} onChange={(e) => setActuel(e.target.value)} autoComplete="current-password" required />
        <Champ label="Nouveau mot de passe" type="password" aide="6 caractères minimum." value={nouveau} onChange={(e) => setNouveau(e.target.value)} autoComplete="new-password" required minLength={6} />
        {etat && <Message type={etat.type}>{etat.texte}</Message>}
        <Btn type="submit" chargement={envoi} className="w-full">Enregistrer</Btn>
      </form>
    </details>
  );
}
