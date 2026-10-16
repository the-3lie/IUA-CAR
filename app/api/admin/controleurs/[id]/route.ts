import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, entierId, route } from '@/lib/api';
import { sql } from '@/lib/db';
import { genererMotDePasseTemporaire } from '@/lib/codes';
import { journaliser } from '@/lib/audit';

const schema = z.object({ actif: z.boolean().optional(), reinitialiser_mot_de_passe: z.boolean().optional() });

export const PATCH = route(['admin'], async ({ req, params, session }) => {
  const id = entierId(params.id);
  const d = await corps(req, schema);
  const rows = await sql<any>`SELECT identifiant FROM utilisateurs WHERE id = ${id} AND role = 'controleur'`;
  if (!rows[0]) throw new ApiError(404, 'Contrôleur introuvable.');
  const ident = rows[0].identifiant;
  let mot_de_passe: string | undefined;
  if (d.actif !== undefined) {
    await sql`UPDATE utilisateurs SET actif = ${d.actif} WHERE id = ${id}`;
    await journaliser(session, d.actif ? 'controleur.reactive' : 'controleur.desactive', ident);
  }
  if (d.reinitialiser_mot_de_passe) {
    mot_de_passe = genererMotDePasseTemporaire();
    await sql`UPDATE utilisateurs SET mot_de_passe_hash = ${await bcrypt.hash(mot_de_passe, 10)} WHERE id = ${id}`;
    await journaliser(session, 'controleur.reinit_mdp', ident);
  }
  return { ok: true, mot_de_passe };
});
