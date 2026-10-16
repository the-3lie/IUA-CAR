import { route } from '@/lib/api';
import { query } from '@/lib/db';

const TAILLE = 50;

export const GET = route(['admin'], async ({ req }) => {
  const page = Math.max(1, parseInt(new URL(req.url).searchParams.get('page') ?? '1', 10) || 1);
  const [{ n }] = await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM journal`);
  const items = await query(
    `SELECT id, action, utilisateur_nom, detail, cree_le FROM journal ORDER BY id DESC LIMIT ${TAILLE} OFFSET ${(page - 1) * TAILLE}`,
  );
  return { total: n, page, pages: Math.max(1, Math.ceil(n / TAILLE)), items };
});
