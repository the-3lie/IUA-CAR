import { route } from '@/lib/api';
import { sql } from '@/lib/db';
import { getRegle } from '@/lib/regle';

/** Liste complète téléchargée avant le trajet, pour le mode hors-ligne (stockée dans IndexedDB). */
export const GET = route(['controleur'], async () => {
  const [cars, regle, etudiants] = await Promise.all([
    sql`SELECT id, nom FROM cars ORDER BY NULLIF(regexp_replace(nom, '[^0-9]', '', 'g'), '')::int NULLS LAST, nom`,
    getRegle(),
    sql`SELECT id, matricule, nom, car_id, montant_du, total_paye, solde, actif, jeton_qr AS jeton FROM etudiants`,
  ]);
  return { cars, regle, etudiants, telecharge_le: new Date().toISOString() };
});
