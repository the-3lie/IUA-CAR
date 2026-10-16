import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, ipClient, routePublique } from '@/lib/api';
import { sql } from '@/lib/db';
import { getParametres } from '@/lib/regle';
import { nomCorrespond } from '@/lib/shared';
import { ouvrirSession, ACCUEIL } from '@/lib/session';
import { effacerEchecs, enregistrerEchec, verifierBlocage } from '@/lib/ratelimit';

const schema = z.object({
  matricule: z.string().trim().min(1, 'Matricule requis.').max(40),
  verification: z.string().trim().min(2, 'Saisissez votre nom ou votre code d’activation.').max(120),
  mot_de_passe: z.string().min(6, 'Le mot de passe doit contenir au moins 6 caractères.').max(100),
});

export const POST = routePublique(async ({ req }) => {
  const { matricule, verification, mot_de_passe } = await corps(req, schema);
  const mat = matricule.toUpperCase();
  const cleMat = `activation:${mat}`;
  const cleIp = `ip:${ipClient(req)}`;
  await verifierBlocage(cleMat);
  await verifierBlocage(cleIp);

  const rows = await sql<any>`SELECT id, nom, actif, mot_de_passe_hash, code_activation FROM etudiants WHERE matricule = ${mat}`;
  const e = rows[0];
  const { activation } = await getParametres();

  const codeOk = !!e?.code_activation && verification.replace(/\s/g, '').toUpperCase() === e.code_activation;
  const nomOk = !!e && activation === 'nom' && nomCorrespond(verification, e.nom);

  if (!e || (!codeOk && !nomOk)) {
    await enregistrerEchec(cleMat, 5);
    await enregistrerEchec(cleIp, 40);
    throw new ApiError(
      400,
      activation === 'code'
        ? 'Matricule ou code d’activation incorrect.'
        : 'Matricule ou nom incorrect. Saisissez votre nom tel qu’il figure sur la liste.',
    );
  }
  if (e.mot_de_passe_hash) throw new ApiError(409, 'Ce compte est déjà activé. Connectez-vous avec votre mot de passe.', 'deja_active');
  if (!e.actif) throw new ApiError(403, 'Compte désactivé. Rapprochez-vous de l’administration.');

  const hash = await bcrypt.hash(mot_de_passe, 10);
  const maj = await sql`UPDATE etudiants SET mot_de_passe_hash = ${hash}, date_activation = now(), code_activation = NULL, maj_le = now()
                        WHERE id = ${e.id} AND mot_de_passe_hash IS NULL RETURNING id`;
  if (maj.length === 0) throw new ApiError(409, 'Ce compte est déjà activé.', 'deja_active');
  await effacerEchecs(cleMat);
  await ouvrirSession({ uid: e.id, role: 'etudiant', nom: e.nom });
  return { redirection: ACCUEIL.etudiant };
});
