'use client';
import { Carte, Chargement, Message } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import type { Regle } from '@/lib/shared';

type Stats = {
  regle: Regle; total_etudiants: number; en_regle: number; taux_en_regle: number;
  par_car: { id: number; nom: string; total: number; en_regle: number }[];
  sans_car: { total: number; en_regle: number };
  passages_jour: { montee: number; descente: number; a_verifier: number; total: number };
  semaine: { jour: string; n: number }[];
  non_inscrits: { jour: number; sept_jours: number };
};

const jourCourt = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');

export default function TableauDeBord() {
  const { data: s, erreur, chargement } = useApi<Stats>('/api/admin/stats');
  if (chargement && !s) return <Chargement />;
  if (erreur || !s) return <Message>{erreur ?? 'Statistiques indisponibles.'}</Message>;
  const max = Math.max(1, ...s.semaine.map((j) => j.n));

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-extrabold">Tableau de bord</h1>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Carte className="p-6">
          <p className="font-semibold text-encre-2">Passages aujourd’hui</p>
          <p className="nombres mt-1 font-display text-7xl font-extrabold leading-none">{s.passages_jour.total}</p>
          <p className="mt-2 text-encre-2">
            {s.passages_jour.montee} montée{s.passages_jour.montee > 1 ? 's' : ''} et {s.passages_jour.descente} descente{s.passages_jour.descente > 1 ? 's' : ''}
            {s.passages_jour.a_verifier > 0 && <>, dont <strong className="text-alerte-texte">{s.passages_jour.a_verifier} à vérifier</strong></>}
          </p>
          <div className="mt-6 flex h-28 items-end gap-2" role="img" aria-label="Passages des 7 derniers jours">
            {s.semaine.map((j, i) => (
              <div key={j.jour} className="flex flex-1 flex-col items-center gap-1">
                <span className="nombres text-xs font-semibold text-encre-2">{j.n}</span>
                <div className={`w-full rounded-t-md ${i === s.semaine.length - 1 ? 'bg-car' : 'bg-encre/80'}`} style={{ height: `${Math.max(4, (j.n / max) * 72)}px` }} />
                <span className="text-xs text-encre-2">{jourCourt(j.jour)}</span>
              </div>
            ))}
          </div>
        </Carte>

        <div className="flex flex-col gap-6">
          <Carte className="p-6">
            <p className="font-semibold text-encre-2">Étudiants à jour</p>
            <p className="nombres mt-1 font-display text-5xl font-extrabold leading-none">{s.taux_en_regle} %</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-trait/70"><div className="h-full rounded-full bg-ok" style={{ width: `${s.taux_en_regle}%` }} /></div>
            <p className="mt-2 text-sm text-encre-2">
              {s.en_regle} sur {s.total_etudiants} étudiants actifs · règle : {s.regle.mode === 'paliers' ? `paliers ${[s.regle.paliers.p1, s.regle.paliers.p2, s.regle.paliers.p3].map((v) => v.toLocaleString('fr-FR')).join(' / ')} FCFA` : s.regle.mode === 'pourcentage' ? `${s.regle.valeur} % payé` : `au moins ${s.regle.valeur.toLocaleString('fr-FR')} FCFA`}
            </p>
          </Carte>
          <Carte className="border-danger/40 bg-danger-clair p-6">
            <p className="font-semibold text-danger">Non-inscrits repérés</p>
            <p className="nombres mt-1 font-display text-5xl font-extrabold leading-none text-danger">{s.non_inscrits.jour}</p>
            <p className="mt-2 text-sm text-encre-2">aujourd’hui · {s.non_inscrits.sept_jours} sur les 7 derniers jours</p>
          </Carte>
        </div>
      </div>

      <Carte>
        <h2 className="px-6 pt-5 font-display text-xl font-extrabold">Étudiants par car</h2>
        <div className="overflow-x-auto">
          <table className="mt-3 w-full text-left">
            <thead className="border-y border-trait bg-fond text-sm text-encre-2">
              <tr><th className="px-6 py-2 font-semibold">Car</th><th className="px-3 py-2 text-right font-semibold">Étudiants</th><th className="px-3 py-2 text-right font-semibold">À jour</th><th className="w-1/3 px-6 py-2 font-semibold">Part à jour</th></tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {[...s.par_car, ...(s.sans_car.total ? [{ id: 0, nom: 'Sans car', ...s.sans_car }] : [])].map((c) => {
                const p = c.total ? Math.round((c.en_regle / c.total) * 100) : 0;
                return (
                  <tr key={c.id}>
                    <td className="px-6 py-3 font-bold">{c.nom}</td>
                    <td className="nombres px-3 py-3 text-right">{c.total}</td>
                    <td className="nombres px-3 py-3 text-right">{c.en_regle}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-trait/70"><div className="h-full bg-ok" style={{ width: `${p}%` }} /></div>
                        <span className="nombres w-10 text-right text-sm font-semibold">{p} %</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {s.par_car.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-encre-2">Aucun car pour le moment. Commencez par importer les fiches Excel.</td></tr>}
            </tbody>
          </table>
        </div>
      </Carte>
    </div>
  );
}
