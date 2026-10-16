import { randomBytes, randomInt } from 'node:crypto';

/** Jeton QR : 192 bits aléatoires, impossible à deviner. */
export const genererJeton = () => randomBytes(24).toString('base64url');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans O/0/I/1/L pour éviter les confusions

export function genererCode(longueur = 8): string {
  let s = '';
  for (let i = 0; i < longueur; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export const genererMotDePasseTemporaire = () => genererCode(4) + '-' + genererCode(4);
