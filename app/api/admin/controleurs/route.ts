import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, route } from '@/lib/api';
import { DEBUT_JOUR_SQL, query, sql } from '@/lib/db';
import { genererMotDePasseTemporaire } from '@/lib/codes';
import { journaliser } from '@/lib/audit';

export const GET = route(['admin'], async () => ({
  controleurs: await query(
    `SELECT u.id, u.identifiant, u.nom, u.actif, u.cree_le,
            (SELECT COUNT(*)::int FROM passages p WHERE p.controleur_id = u.id AND p.annule = FALSE AND p.horodatage >= ${DEBUT_JOUR_SQL}) AS scans_jour
       FROM utilisateurs u WHERE u.role = 'controleur' ORDER BY u.nom`,
  ),
}));

const schema = z.object({
  identifiant: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/, 'Identifiant : 3 à 30 caractères (lettres, chiffres, . _ -).'),
  nom: z.string().trim().min(2, 'Nom requis.').max(80),
  mot_de_passe: z.string().min(6, 'Mot de passe : 6 caractères minimum.').max(100).optional(),
});

export const POST = route(['admin'], async ({ req, session }) => {
  const d = await corps(req, schema);
  const mdp = d.mot_de_passe ?? genererMotDePasseTemporaire();
  try {
    const r = await sql<{ id: number }>`
      INSERT INTO utilisateurs (identifiant, nom, mot_de_passe_hash, role)
      VALUES (${d.identifiant}, ${d.nom}, ${await bcrypt.hash(mdp, 10)}, 'controleur') RETURNING id`;
    await journaliser(session, 'controleur.cree', d.identifiant);
    return { id: r[0].id, identifiant: d.identifiant, mot_de_passe: mdp };
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new ApiError(409, 'Cet identifiant existe déjà.');
    throw e;
  }
});
