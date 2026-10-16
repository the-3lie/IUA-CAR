'use client';
import { useState } from 'react';
import { Btn, Carte, Champ, Chargement, Message, Selection } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { RESULTAT_LABEL } from '@/lib/shared';

type Rapport = { titre: string; colonnes: string[]; lignes: (string | number)[][]; total: number; tronque: boolean };

const TYPES = [
  ['passages', 'Historique de tous les passages'],
  ['non_inscrits', 'Non-inscrits repérés'],
  ['paiements_incomplets', 'Passages avec paiement incomplet'],
  ['doublons', 'Doublons de scan'],
  ['etudiants_non_en_regle', 'Étudiants pas à jour aujourd’hui (liste)'],
  ['codes_activation', 'Codes d’activation (comptes non activés)'],
] as const;

export default function Rapports() {
  const [type, setType] = useState<string>('passages');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [car, setCar] = useState('');
  const [ctl, setCtl] = useState('');
  const [res, setRes] = useState('');
  const [annules, setAnnules] = useState(false);
  const parPassages = !['etudiants_non_en_regle', 'codes_activation'].includes(type);

  const p = new URLSearchParams({ type });
  if (parPassages) {
    if (du) p.set('du', du); if (au) p.set('au', au); if (ctl) p.set('controleur', ctl);
    if (res && ['passages', 'doublons'].includes(type)) p.set('resultat', res);
    if (annules) p.set('annules', '1');
  }
  if (car) p.set('car', car);
  const { data, erreur, chargement } = useApi<Rapport>(`/api/admin/rapports?${p}`);
  const { data: cars } = useApi<{ cars: { id: number; nom: string }[] }>('/api/admin/cars');
  const { data: ctls } = useApi<{ controleurs: { id: number; nom: string }[] }>('/api/admin/controleurs');

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold">Rapports</h1>
      <Carte className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Selection label="Rapport" value={type} onChange={(e) => setType(e.target.value)} className="sm:col-span-2">
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Selection>
        <Selection label="Car" value={car} onChange={(e) => setCar(e.target.value)}>
          <option value="">Tous les cars</option>{cars?.cars.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Selection>
        {parPassages && (
          <>
            <Selection label="Contrôleur" value={ctl} onChange={(e) => setCtl(e.target.value)}>
              <option value="">Tous</option>{ctls?.controleurs.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Selection>
            <Champ label="Du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
            <Champ label="Au" type="date" value={au} onChange={(e) => setAu(e.target.value)} />
            {['passages', 'doublons'].includes(type) && (
              <Selection label="Résultat" value={res} onChange={(e) => setRes(e.target.value)}>
                <option value="">Tous</option>{Object.entries(RESULTAT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Selection>
            )}
            <label className="flex min-h-12 items-center gap-2 self-end font-medium"><input type="checkbox" className="size-5" checked={annules} onChange={(e) => setAnnules(e.target.checked)} /> Inclure les scans annulés</label>
          </>
        )}
      </Carte>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="nombres text-encre-2">{data ? `${data.total} ligne${data.total > 1 ? 's' : ''}${data.tronque ? ` (${data.lignes.length} affichées, exportez pour tout avoir)` : ''}` : ''}</p>
        <a href={`/api/admin/rapports?${p}&format=xlsx`} className="inline-flex min-h-12 items-center rounded-xl bg-car px-5 font-semibold hover:bg-[#ffcd3a]">Exporter en Excel</a>
      </div>

      {erreur && <Message>{erreur}</Message>}
      {chargement && !data ? <Chargement /> : data && (
        <Carte className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-trait bg-fond text-encre-2"><tr>{data.colonnes.map((c) => <th key={c} className="whitespace-nowrap px-4 py-2.5">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-trait">
              {data.lignes.length === 0 && <tr><td colSpan={data.colonnes.length} className="px-4 py-10 text-center text-encre-2">Aucune donnée pour ces filtres.</td></tr>}
              {data.lignes.map((l, i) => <tr key={i}>{l.map((v, j) => <td key={j} className="nombres px-4 py-2">{v}</td>)}</tr>)}
            </tbody>
          </table>
        </Carte>
      )}
    </div>
  );
}
