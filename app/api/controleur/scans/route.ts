import { route } from '@/lib/api';
import { DEBUT_JOUR_SQL, query } from '@/lib/db';

export const GET = route(['controleur'], async ({ session }) => {
  const scans = await query(
    `SELECT p.id, p.horodatage, p.type, p.resultat, p.detail, p.doublon, p.client_uid,
            e.nom AS etudiant, e.matricule, p.nom_saisi, c.nom AS car
       FROM passages p
       LEFT JOIN etudiants e ON e.id = p.etudiant_id
       LEFT JOIN cars c ON c.id = p.car_id
      WHERE p.controleur_id = $1 AND p.annule = FALSE AND p.horodatage >= ${DEBUT_JOUR_SQL}
      ORDER BY p.horodatage DESC LIMIT 100`,
    [session.uid],
  );
  return { scans };
});
