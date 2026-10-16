import { route } from '@/lib/api';
import { sql } from '@/lib/db';

export const GET = route(['admin'], async () => ({
  cars: await sql`SELECT id, nom FROM cars ORDER BY NULLIF(regexp_replace(nom, '[^0-9]', '', 'g'), '')::int NULLS LAST, nom`,
}));
