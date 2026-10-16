import { sql } from './db';
import type { Session } from './jwt';

export async function journaliser(s: Pick<Session, 'uid' | 'nom'> | null, action: string, detail?: string) {
  try {
    await sql`INSERT INTO journal (action, utilisateur_id, utilisateur_nom, detail)
              VALUES (${action}, ${s?.uid ?? null}, ${s?.nom ?? null}, ${detail ?? null})`;
  } catch (e) {
    console.error('[journal]', e);
  }
}
