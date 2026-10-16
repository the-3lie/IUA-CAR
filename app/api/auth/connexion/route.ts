import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, ipClient, routePublique } from '@/lib/api';
import { sql } from '@/lib/db';
import { ouvrirSession, ACCUEIL } from '@/lib/session';
import { effacerEchecs, enregistrerEchec, verifierBlocage } from '@/lib/ratelimit';

const schema = z.object({
  identifiant: z.string().trim().min(1, 'Identifiant requis.').max(60),
  mot_de_passe: z.string().min(1, 'Mot de passe requis.').max(100),
  espace: z.enum(['etudiant', 'personnel']),
});

let fauxHash: string | null = null;

export const POST = routePublique(async ({ req }) => {
  const { identifiant, mot_de_passe, espace } = await corps(req, schema);
  const cleId = `connexion:${espace}:${identifiant.toLowerCase()}`;
  const cleIp = `ip:${ipClient(req)}`;
  await verifierBlocage(cleId);
  await verifierBlocage(cleIp);

  const echec = async (): Promise<never> => {
    await enregistrerEchec(cleId, 5);
    await enregistrerEchec(cleIp, 40);
    throw new ApiError(401, 'Identifiant ou mot de passe incorrect.');
  };
  // Comparaison factice quand le compte n'existe pas, pour ne pas révéler son existence par le temps de réponse.
  const comparerFaux = async () => {
    fauxHash ??= await bcrypt.hash('faux-mot-de-passe', 10);
    await bcrypt.compare(mot_de_passe, fauxHash);
  };

  if (espace === 'etudiant') {
    const rows = await sql<any>`SELECT id, nom, mot_de_passe_hash, actif FROM etudiants WHERE matricule = ${identifiant.toUpperCase()}`;
    const e = rows[0];
    if (!e) { await comparerFaux(); return echec(); }
    if (!e.mot_de_passe_hash) {
      throw new ApiError(409, 'Ce compte n’est pas encore activé. Utilisez « Première connexion ».', 'non_active');
    }
    if (!(await bcrypt.compare(mot_de_passe, e.mot_de_passe_hash))) return echec();
    if (!e.actif) throw new ApiError(403, 'Compte désactivé. Rapprochez-vous de l’administration.');
    await effacerEchecs(cleId);
    await ouvrirSession({ uid: e.id, role: 'etudiant', nom: e.nom });
    return { role: 'etudiant', redirection: ACCUEIL.etudiant };
  }

  const rows = await sql<any>`SELECT id, nom, role, mot_de_passe_hash, actif FROM utilisateurs WHERE identifiant = ${identifiant.toLowerCase()}`;
  const u = rows[0];
  if (!u) { await comparerFaux(); return echec(); }
  if (!(await bcrypt.compare(mot_de_passe, u.mot_de_passe_hash))) return echec();
  if (!u.actif) throw new ApiError(403, 'Compte désactivé. Contactez l’administrateur.');
  await effacerEchecs(cleId);
  await ouvrirSession({ uid: u.id, role: u.role, nom: u.nom });
  return { role: u.role, redirection: ACCUEIL[u.role as 'admin' | 'controleur'] };
});
