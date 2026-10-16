import { z } from 'zod';
import { corps, route } from '@/lib/api';
import { traiterLot } from '@/lib/scan';
import { schemaScan } from '@/lib/schemas';

const schema = z.object({ scans: z.array(schemaScan).min(1).max(100) });

export const POST = route(['controleur'], async ({ req, session }) => {
  const { scans } = await corps(req, schema);
  return { resultats: await traiterLot(scans, session.uid) };
});
