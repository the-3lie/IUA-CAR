'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Btn, Carte, Chargement, Message, PastilleStatut, Selection, Vide } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { fcfa, type Statut } from '@/lib/shared';

type Liste = {
  total: number; page: number; pages: number;
  items: { id: number; matricule: string; nom: string; car: string | null; montant_du: number; total_paye: number; solde: number; actif: boolean; active: boolean; statut: Statut }[];
};

export default function Etudiants() {
  const [q, setQ] = useState('');
  const [qDiffere, setQDiffere] = useState('');
  const [car, setCar] = useState('');
  const [statut, setStatut] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setQDiffere(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

  const params = new URLSearchParams({ page: String(page) });
  if (qDiffere) params.set('q', qDiffere);
  if (car) params.set('car', car);
  if (statut) params.set('statut', statut);
  if (active) params.set('active', active);
  const { data, erreur, chargement } = useApi<Liste>(`/api/admin/etudiants?${params}`);
  const { data: cars } = useApi<{ cars: { id: number; nom: string }[] }>('/api/admin/cars');
  const filtre = (fn: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { fn(e.target.value); setPage(1); };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold">Étudiants</h1>
        {data && <p className="nombres text-encre-2">{data.total} résultat{data.total > 1 ? 's' : ''}</p>}
      </div>

      <Carte className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <label htmlFor="rech" className="mb-1.5 block text-sm font-semibold">Matricule ou nom</label>
          <input id="rech" value={q} onChange={(e) => setQ(e.target.value)} className="min-h-12 w-full rounded-xl border-2 border-trait bg-surface px-3.5 focus:border-encre focus:outline-none" />
        </div>
        <Selection label="Car" value={car} onChange={filtre(setCar)}>
          <option value="">Tous les cars</option>
          {cars?.cars.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          <option value="sans">Sans car</option>
        </Selection>
        <Selection label="Paiement" value={statut} onChange={filtre(setStatut)}>
          <option value="">Tous</option><option value="en_regle">En règle</option><option value="solde_a_payer">Solde à payer</option><option value="non_solde">Non soldé</option>
        </Selection>
        <Selection label="Compte" value={active} onChange={filtre(setActive)}>
          <option value="">Tous</option><option value="oui">Activé</option><option value="non">Non activé</option>
        </Selection>
      </Carte>

      {erreur && <Message>{erreur}</Message>}
      {chargement && !data ? <Chargement /> : data && (
        <Carte>
          {data.items.length === 0 ? <Vide>Aucun étudiant ne correspond à cette recherche.</Vide> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-b border-trait bg-fond text-sm text-encre-2">
                  <tr><th className="px-5 py-2.5">Matricule</th><th className="px-3 py-2.5">Nom et prénoms</th><th className="px-3 py-2.5">Car</th><th className="px-3 py-2.5 text-right">Solde</th><th className="px-3 py-2.5">Paiement</th><th className="px-5 py-2.5">Compte</th></tr>
                </thead>
                <tbody className="divide-y divide-trait">
                  {data.items.map((e) => (
                    <tr key={e.id} className="hover:bg-fond/70">
                      <td className="nombres px-5 py-3 font-semibold"><Link href={`/admin/etudiants/${e.id}`} className="underline underline-offset-4">{e.matricule}</Link></td>
                      <td className="px-3 py-3">{e.nom}</td>
                      <td className="px-3 py-3 font-semibold">{e.car ?? '—'}</td>
                      <td className="nombres px-3 py-3 text-right">{fcfa(e.solde)}</td>
                      <td className="px-3 py-3"><PastilleStatut statut={e.statut} /></td>
                      <td className="px-5 py-3 text-sm">{!e.actif ? <span className="font-bold text-danger">Désactivé</span> : e.active ? 'Activé' : <span className="text-encre-2">Non activé</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.pages > 1 && (
            <div className="flex items-center justify-between border-t border-trait p-3">
              <Btn variante="contour" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Btn>
              <span className="nombres text-sm text-encre-2">Page {data.page} sur {data.pages}</span>
              <Btn variante="contour" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Suivant</Btn>
            </div>
          )}
        </Carte>
      )}
    </div>
  );
}
