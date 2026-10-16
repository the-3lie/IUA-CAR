import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { condEnRegleSql, getRegle } from '@/lib/regle';
import { normaliser, statutPaiement } from '@/lib/shared';

const TAILLE = 30;

export const GET = route(['admin'], async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const regle = await getRegle();
  const ok = condEnRegleSql(regle, 'e');
  const where: string[] = [];
  const p: unknown[] = [];
  const q = (u.get('q') ?? '').replace(/[%_\\]/g, '').trim().slice(0, 60);
  if (q) {
    p.push(`%${q}%`, `%${normaliser(q)}%`);
    where.push(`(e.matricule ILIKE $${p.length - 1} OR e.nom_normalise LIKE $${p.length})`);
  }
  const car = u.get('car');
  if (car === 'sans') where.push('e.car_id IS NULL');
  else if (car && /^\d+$/.test(car)) { p.push(Number(car)); where.push(`e.car_id = $${p.length}`); }
  const statut = u.get('statut');
  if (statut === 'en_regle') where.push(ok);
  else if (statut === 'solde_a_payer') where.push(`(NOT ${ok} AND e.total_paye > 0)`);
  else if (statut === 'non_solde') where.push(`(NOT ${ok} AND e.total_paye <= 0)`);
  const actif = u.get('actif');
  if (actif === '1') where.push('e.actif'); else if (actif === '0') where.push('NOT e.actif');
  const active = u.get('active');
  if (active === 'oui') where.push('e.mot_de_passe_hash IS NOT NULL'); else if (active === 'non') where.push('e.mot_de_passe_hash IS NULL');
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const page = Math.max(1, parseInt(u.get('page') ?? '1', 10) || 1);

  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM etudiants e ${w}`, p);
  const items = await query<any>(
    `SELECT e.id, e.matricule, e.nom, e.car_id, c.nom AS car, e.montant_du, e.total_paye, e.solde, e.actif,
            (e.mot_de_passe_hash IS NOT NULL) AS active
       FROM etudiants e LEFT JOIN cars c ON c.id = e.car_id ${w}
      ORDER BY e.nom LIMIT ${TAILLE} OFFSET ${(page - 1) * TAILLE}`,
    p,
  );
  return {
    total: n, page, pages: Math.max(1, Math.ceil(n / TAILLE)),
    items: items.map((e) => ({ ...e, statut: statutPaiement(e, regle) })),
  };
});
