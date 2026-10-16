import { routePublique } from '@/lib/api';
import { fermerSession } from '@/lib/session';

export const POST = routePublique(async () => {
  await fermerSession();
  return { ok: true };
});
