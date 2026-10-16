import { cookies } from 'next/headers';
import { COOKIE, dureeSession, signer, verifier, type Session } from './jwt';

export async function ouvrirSession(s: Session) {
  const token = await signer(s);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: dureeSession(s.role),
  });
}

export async function fermerSession() {
  const jar = await cookies();
  jar.set(COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function sessionCourante(): Promise<Session | null> {
  const jar = await cookies();
  return verifier(jar.get(COOKIE)?.value);
}

export const ACCUEIL: Record<Session['role'], string> = {
  etudiant: '/etudiant',
  controleur: '/controleur',
  admin: '/admin',
};
