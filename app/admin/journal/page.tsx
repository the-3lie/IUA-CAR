'use client';
import { useState } from 'react';
import { Btn, Carte, Chargement, Message, Vide } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { formatDateHeure } from '@/lib/shared';

const LIBELLES: Record<string, string> = {
  'import.excel': 'Import Excel', 'etudiant.car': 'Changement de car', 'etudiant.desactive': 'Étudiant désactivé', 'etudiant.reactive': 'Étudiant réactivé',
  'etudiant.reinit_mdp': 'Mot de passe étudiant réinitialisé', 'etudiant.regenere_qr': 'QR code régénéré', 'controleur.cree': 'Contrôleur créé',
  'controleur.desactive': 'Contrôleur désactivé', 'controleur.reactive': 'Contrôleur réactivé', 'controleur.reinit_mdp': 'Mot de passe contrôleur réinitialisé',
  'parametres.modifie': 'Paramètres modifiés', 'scan.annule': 'Scan annulé',
};

export default function Journal() {
  const [page, setPage] = useState(1);
  const { data, erreur, chargement } = useApi<{ page: number; pages: number; total: number; items: { id: string; action: string; utilisateur_nom: string | null; detail: string | null; cree_le: string }[] }>(`/api/admin/journal?page=${page}`);
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-extrabold">Journal d’audit</h1>
      {erreur && <Message>{erreur}</Message>}
      {chargement && !data ? <Chargement /> : data && (
        <Carte>
          {data.items.length === 0 ? <Vide>Aucune action enregistrée.</Vide> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-trait bg-fond text-encre-2"><tr><th className="px-5 py-2.5">Date et heure</th><th className="px-3 py-2.5">Utilisateur</th><th className="px-3 py-2.5">Action</th><th className="px-5 py-2.5">Détail</th></tr></thead>
              <tbody className="divide-y divide-trait">
                {data.items.map((j) => (
                  <tr key={j.id}><td className="nombres whitespace-nowrap px-5 py-2.5">{formatDateHeure(j.cree_le)}</td><td className="px-3 py-2.5">{j.utilisateur_nom ?? '—'}</td><td className="px-3 py-2.5 font-semibold">{LIBELLES[j.action] ?? j.action}</td><td className="px-5 py-2.5 text-encre-2">{j.detail}</td></tr>
                ))}
              </tbody>
            </table></div>
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
