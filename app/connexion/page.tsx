import { redirect } from 'next/navigation';
import { ACCUEIL, sessionCourante } from '@/lib/session';
import FormulaireConnexion from './FormulaireConnexion';

export const metadata = { title: 'Connexion' };
export const dynamic = 'force-dynamic';

export default async function Connexion() {
  const s = await sessionCourante();
  if (s) redirect(ACCUEIL[s.role]);
  return <FormulaireConnexion />;
}
