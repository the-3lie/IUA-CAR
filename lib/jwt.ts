import { SignJWT, jwtVerify } from 'jose';
import { ConfigError } from './errors';

export type Role = 'etudiant' | 'controleur' | 'admin';
export type Session = { uid: number; role: Role; nom: string };

export const COOKIE = 'cc_session';

const DUREES: Record<Role, number> = {
  etudiant: 60 * 60 * 24 * 30,
  controleur: 60 * 60 * 24,
  admin: 60 * 60 * 12,
};
export const dureeSession = (r: Role) => DUREES[r];

function cle(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new ConfigError('AUTH_SECRET est manquant ou trop court (16 caractères minimum).');
  return new TextEncoder().encode(s);
}

export async function signer(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, nom: s.nom })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(s.uid))
    .setIssuedAt()
    .setExpirationTime(`${DUREES[s.role]}s`)
    .sign(cle());
}

export async function verifier(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, cle(), { algorithms: ['HS256'] });
    const role = payload.role as Role;
    if (!['etudiant', 'controleur', 'admin'].includes(role)) return null;
    return { uid: Number(payload.sub), role, nom: String(payload.nom ?? '') };
  } catch {
    return null;
  }
}
