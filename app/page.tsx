import { redirect } from 'next/navigation';
import { ACCUEIL, sessionCourante } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function Accueil() {
  const s = await sessionCourante();
  redirect(s ? ACCUEIL[s.role] : '/connexion');
}
