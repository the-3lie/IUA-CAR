import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, route } from '@/lib/api';
import { sql } from '@/lib/db';
import { enregistrerEchec, verifierBlocage, effacerEchecs } from '@/lib/ratelimit';

const schema = z.object({
  actuel: z.string().min(1, 'Saisissez votre mot de passe actuel.').max(100),
  nouveau: z.string().min(6, 'Le nouveau mot de passe doit contenir au moins 6 caractères.').max(100),
});

export const POST = route(['etudiant'], async ({ req, session }) => {
  const { actuel, nouveau } = await corps(req, schema);
  const cle = `mdp:${session.uid}`;
  await verifierBlocage(cle);
  const rows = await sql<any>`SELECT mot_de_passe_hash FROM etudiants WHERE id = ${session.uid}`;
  if (!(await bcrypt.compare(actuel, rows[0].mot_de_passe_hash))) {
    await enregistrerEchec(cle, 5);
    throw new ApiError(400, 'Mot de passe actuel incorrect.');
  }
  await effacerEchecs(cle);
  await sql`UPDATE etudiants SET mot_de_passe_hash = ${await bcrypt.hash(nouveau, 10)}, maj_le = now() WHERE id = ${session.uid}`;
  return { ok: true };
});
