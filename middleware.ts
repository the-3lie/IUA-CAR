import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE, verifier, type Role } from '@/lib/jwt';

const ESPACES: { prefixe: string; role: Role }[] = [
  { prefixe: '/etudiant', role: 'etudiant' },
  { prefixe: '/controleur', role: 'controleur' },
  { prefixe: '/admin', role: 'admin' },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const espace = ESPACES.find((e) => pathname === e.prefixe || pathname.startsWith(e.prefixe + '/'));
  if (!espace) return NextResponse.next();
  const session = await verifier(req.cookies.get(COOKIE)?.value);
  if (!session || session.role !== espace.role) {
    const url = req.nextUrl.clone();
    url.pathname = '/connexion';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/etudiant/:path*', '/controleur/:path*', '/admin/:path*'] };
