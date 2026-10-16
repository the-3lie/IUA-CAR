import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, route } from '@/lib/api';
import { sql } from '@/lib/db';
import { journaliser } from '@/lib/audit';

export const POST = route(['controleur'], async ({ req, session }) => {
  const { id } = await corps(req, z.object({ id: z.number().int().positive() }));
  const r = await sql`UPDATE passages SET annule = TRUE WHERE id = ${id} AND controleur_id = ${session.uid} AND annule = FALSE RETURNING id`;
  if (r.length === 0) throw new ApiError(404, 'Scan introuvable ou déjà annulé.');
  await journaliser(session, 'scan.annule', `Passage #${id}`);
  return { ok: true };
});
