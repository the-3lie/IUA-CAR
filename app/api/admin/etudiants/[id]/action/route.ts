import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, entierId, route } from '@/lib/api';
import { sql } from '@/lib/db';
import { genererCode, genererJeton } from '@/lib/codes';
import { PREFIXE_QR } from '@/lib/shared';
import { journaliser } from '@/lib/audit';

const schema = z.object({ action: z.enum(['reinitialiser_mot_de_passe', 'regenerer_qr']) });

export const POST = route(['admin'], async ({ req, params, session }) => {
  const id = entierId(params.id);
  const { action } = await corps(req, schema);
  if (action === 'reinitialiser_mot_de_passe') {
    const code = genererCode();
    const r = await sql<{ matricule: string }>`
      UPDATE etudiants SET mot_de_passe_hash = NULL, date_activation = NULL, code_activation = ${code}, maj_le = now()
       WHERE id = ${id} RETURNING matricule`;
    if (!r[0]) throw new ApiError(404, 'Étudiant introuvable.');
    await journaliser(session, 'etudiant.reinit_mdp', r[0].matricule);
    return { code_activation: code };
  }
  const jeton = genererJeton();
  const r = await sql<{ matricule: string }>`UPDATE etudiants SET jeton_qr = ${jeton}, maj_le = now() WHERE id = ${id} RETURNING matricule`;
  if (!r[0]) throw new ApiError(404, 'Étudiant introuvable.');
  await journaliser(session, 'etudiant.regenere_qr', r[0].matricule);
  return { qr: PREFIXE_QR + jeton };
});
