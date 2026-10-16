'use client';
import { useRef, useState } from 'react';
import { Btn, Carte, Message, cx } from '@/components/ui';
import { api, ErreurApi } from '@/lib/client';
import { lireFichiers, type ResumeFeuille } from '@/lib/importer';
import type { LigneBrute } from '@/lib/import';
import { fcfa } from '@/lib/shared';

type Rapport = {
  applique: boolean;
  resume: {
    lignes_lues: number; valides: number; crees: number; mis_a_jour: number; inchanges: number;
    erreurs: number; doublons: number; incoherences: number; cars: { nom: string; nb: number; nouveau: boolean }[];
  };
  erreurs: { feuille: string; ligne: number; message: string }[];
  doublons: { matricule: string; emplacements: string[]; conserve: string }[];
  avertissements: string[];
  apercu: { matricule: string; nom: string; car: string | null; montant_du: number; total_paye: number; solde: number; action: 'cree' | 'maj' | 'inchange' }[];
};

const ACTION = { cree: ['Créé', 'bg-ok-clair text-ok'], maj: ['Mis à jour', 'bg-alerte-clair text-alerte-texte'], inchange: ['Inchangé', 'bg-fond text-encre-2'] } as const;

export default function ImportExcel() {
  const entree = useRef<HTMLInputElement>(null);
  const [lignes, setLignes] = useState<LigneBrute[]>([]);
  const [feuilles, setFeuilles] = useState<ResumeFeuille[]>([]);
  const [noms, setNoms] = useState('');
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [etat, setEtat] = useState<'repos' | 'lecture' | 'validation'>('repos');
  const [erreur, setErreur] = useState<string | null>(null);

  async function choisir(fichiers: FileList | null) {
    if (!fichiers?.length) return;
    setErreur(null); setRapport(null); setEtat('lecture');
    try {
      const liste = [...fichiers];
      const r = await lireFichiers(liste);
      setLignes(r.lignes); setFeuilles(r.feuilles); setNoms(liste.map((f) => f.name).join(', '));
      if (r.lignes.length === 0) throw new Error('Aucune ligne exploitable. Vérifiez que la première ligne contient les en-têtes (Matricule, Nom et Prénoms, Montant, TOTPAYE, SOLDE, CAR).');
      setRapport(await api<Rapport>('/api/admin/import', { corps: { mode: 'apercu', lignes: r.lignes, fichier: liste.map((f) => f.name).join(', ') } }));
    } catch (e) {
      setErreur((e as Error).message);
    }
    setEtat('repos');
    if (entree.current) entree.current.value = '';
  }

  async function valider() {
    setEtat('validation'); setErreur(null);
    try {
      setRapport(await api<Rapport>('/api/admin/import', { corps: { mode: 'valider', lignes, fichier: noms } }));
      setLignes([]);
    } catch (e) { setErreur((e as ErreurApi).message); }
    setEtat('repos');
  }

  const r = rapport?.resume;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Import des fiches Excel</h1>
        <p className="mt-1 max-w-2xl text-encre-2">
          Un classeur ou une feuille par car. Colonnes lues : Matricule, Nom et Prénoms, Montant, TOTPAYE, SOLDE et CAR
          (à défaut, le nom de la feuille ou du fichier, par exemple « CAR 5 »). Réimporter met à jour les paiements sans toucher aux comptes déjà activés.
        </p>
      </div>

      {!rapport?.applique && (
        <label className="flex cursor-pointer flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-encre/40 bg-surface p-6 hover:border-encre">
          <span className="text-lg font-bold">{etat === 'lecture' ? 'Lecture du fichier…' : 'Choisir un ou plusieurs fichiers (.xlsx, .csv)'}</span>
          <span className="text-encre-2">{noms ? `Fichier actuel : ${noms}` : 'Aucun aperçu tant que vous n’avez pas validé : rien n’est enregistré.'}</span>
          <input ref={entree} type="file" multiple accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => choisir(e.target.files)} disabled={etat !== 'repos'} />
          <span className="inline-flex min-h-12 items-center rounded-xl bg-encre px-5 font-semibold text-white">Parcourir</span>
        </label>
      )}

      {erreur && <Message>{erreur}</Message>}

      {rapport && r && (
        <>
          {rapport.applique ? (
            <Message type="succes">Import terminé : {r.crees} créé(s), {r.mis_a_jour} mis à jour, {r.inchanges} inchangé(s). {r.erreurs > 0 && `${r.erreurs} ligne(s) ignorée(s) pour erreur.`}</Message>
          ) : (
            <Message type="attention">Aperçu : rien n’est encore enregistré. Vérifiez le compte rendu puis validez.</Message>
          )}

          <Carte className="grid grid-cols-2 divide-trait sm:grid-cols-5 sm:divide-x [&>div]:p-4">
            <Stat n={r.crees} t="à créer" c="text-ok" />
            <Stat n={r.mis_a_jour} t="à mettre à jour" />
            <Stat n={r.inchanges} t="inchangés" />
            <Stat n={r.erreurs} t="erreurs" c={r.erreurs ? 'text-danger' : ''} />
            <Stat n={r.doublons} t="doublons de matricule" c={r.doublons ? 'text-alerte-texte' : ''} />
          </Carte>

          <div className="flex flex-wrap gap-2">
            {r.cars.map((c) => (
              <span key={c.nom} className={cx('rounded-full border px-3 py-1 text-sm font-semibold', c.nouveau ? 'border-ok bg-ok-clair text-ok' : 'border-trait bg-surface')}>
                {c.nom} · {c.nb}{c.nouveau ? ' · nouveau' : ''}
              </span>
            ))}
          </div>

          {feuilles.some((f) => f.ignoree) && (
            <Message type="attention">
              Feuilles ignorées : {feuilles.filter((f) => f.ignoree).map((f) => `${f.feuille} (${f.ignoree})`).join(' ; ')}
            </Message>
          )}

          {rapport.doublons.length > 0 && (
            <Detail titre={`${r.doublons} matricule(s) en double : seule la première ligne est conservée`}>
              <ul className="space-y-1 text-sm">{rapport.doublons.map((d) => <li key={d.matricule}><strong className="nombres">{d.matricule}</strong> : {d.emplacements.join(' ; ')}</li>)}</ul>
            </Detail>
          )}
          {rapport.erreurs.length > 0 && (
            <Detail titre={`${r.erreurs} ligne(s) en erreur (ignorées)`} ouvert>
              <ul className="space-y-1 text-sm">{rapport.erreurs.map((e, i) => <li key={i}><span className="font-semibold">{e.feuille}, ligne {e.ligne}</span> : {e.message}</li>)}</ul>
            </Detail>
          )}
          {rapport.avertissements.length > 0 && (
            <Detail titre={`${r.incoherences} incohérence(s) montant / payé / solde`}>
              <ul className="space-y-1 text-sm">{rapport.avertissements.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </Detail>
          )}

          <Carte>
            <h2 className="px-5 pt-4 font-display text-lg font-extrabold">Aperçu ({Math.min(100, r.valides)} premières lignes sur {r.valides})</h2>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[640px] text-left text-sm">
                <thead className="border-y border-trait bg-fond text-encre-2">
                  <tr><th className="px-5 py-2">Matricule</th><th className="px-3 py-2">Nom et prénoms</th><th className="px-3 py-2">Car</th><th className="px-3 py-2 text-right">Dû</th><th className="px-3 py-2 text-right">Payé</th><th className="px-3 py-2 text-right">Solde</th><th className="px-5 py-2">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-trait">
                  {rapport.apercu.map((l) => (
                    <tr key={l.matricule}>
                      <td className="nombres px-5 py-2 font-semibold">{l.matricule}</td><td className="px-3 py-2">{l.nom}</td><td className="px-3 py-2">{l.car ?? '—'}</td>
                      <td className="nombres px-3 py-2 text-right">{fcfa(l.montant_du)}</td><td className="nombres px-3 py-2 text-right">{fcfa(l.total_paye)}</td><td className="nombres px-3 py-2 text-right">{fcfa(l.solde)}</td>
                      <td className="px-5 py-2"><span className={cx('rounded-full px-2.5 py-0.5 text-xs font-bold', ACTION[l.action][1])}>{ACTION[l.action][0]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Carte>

          {!rapport.applique ? (
            <div className="flex flex-wrap gap-3">
              <Btn variante="jaune" grand onClick={valider} chargement={etat === 'validation'} disabled={r.valides === 0}>
                Valider l’import de {r.valides} étudiant{r.valides > 1 ? 's' : ''}
              </Btn>
              <Btn variante="contour" grand onClick={() => { setRapport(null); setLignes([]); setNoms(''); }}>Annuler</Btn>
            </div>
          ) : (
            <Btn variante="contour" grand onClick={() => { setRapport(null); setNoms(''); }}>Importer un autre fichier</Btn>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ n, t, c = '' }: { n: number; t: string; c?: string }) {
  return <div><p className={cx('nombres font-display text-3xl font-extrabold', c)}>{n}</p><p className="text-sm text-encre-2">{t}</p></div>;
}
function Detail({ titre, children, ouvert }: { titre: string; children: React.ReactNode; ouvert?: boolean }) {
  return (
    <details open={ouvert} className="rounded-xl border border-trait bg-surface">
      <summary className="min-h-12 cursor-pointer px-4 py-3 font-semibold">{titre}</summary>
      <div className="max-h-64 overflow-y-auto border-t border-trait p-4">{children}</div>
    </details>
  );
}
