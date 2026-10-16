import { ApiError } from './errors';
import { query, sql } from './db';

const FENETRE_MIN = 15; // fenêtre de comptage des échecs
const BLOCAGE_MIN = 15; // durée du blocage une fois le seuil atteint

export async function verifierBlocage(cle: string) {
  const r = await sql<{ minutes: number }>`
    SELECT CEIL(EXTRACT(EPOCH FROM (bloque_jusqua - now())) / 60)::int AS minutes
    FROM tentatives WHERE cle = ${cle} AND bloque_jusqua IS NOT NULL AND bloque_jusqua > now()`;
  if (r.length) {
    throw new ApiError(429, `Trop de tentatives. Réessayez dans ${Math.max(1, r[0].minutes)} min.`, 'bloque');
  }
}

export async function enregistrerEchec(cle: string, max: number) {
  // Les durées sont des constantes du module : elles sont écrites dans le texte SQL, pas passées en paramètres.
  const expiree = `tentatives.debut < now() - interval '${FENETRE_MIN} minutes'`;
  await query(
    `INSERT INTO tentatives (cle, nb, debut) VALUES ($1, 1, now())
     ON CONFLICT (cle) DO UPDATE SET
       nb = CASE WHEN ${expiree} THEN 1 ELSE tentatives.nb + 1 END,
       debut = CASE WHEN ${expiree} THEN now() ELSE tentatives.debut END,
       bloque_jusqua = CASE
         WHEN (CASE WHEN ${expiree} THEN 1 ELSE tentatives.nb + 1 END) >= $2
         THEN now() + interval '${BLOCAGE_MIN} minutes' ELSE NULL END`,
    [cle, max],
  );
}

export async function effacerEchecs(cle: string) {
  await sql`DELETE FROM tentatives WHERE cle = ${cle}`;
}
