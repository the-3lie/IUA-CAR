import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { normaliser } from '@/lib/shared';

export const GET = route(['controleur'], async ({ req }) => {
  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/[%_\\]/g, '').trim().slice(0, 60);
  if (q.length < 2) return { etudiants: [] };
  const etudiants = await query(
    `SELECT e.id, e.matricule, e.nom, e.car_id, e.montant_du, e.total_paye, e.solde, e.actif
       FROM etudiants e
      WHERE e.matricule ILIKE $1 OR e.nom_normalise LIKE $2
      ORDER BY e.nom LIMIT 15`,
    [`%${q}%`, `%${normaliser(q)}%`],
  );
  return { etudiants };
});
