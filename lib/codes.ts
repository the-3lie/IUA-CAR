import { randomBytes, randomInt } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Jeton QR : 128 bits aléatoires, impossible à deviner, en base32 MAJUSCULE.
 * Avec le préfixe « CC1: », tout le texte tient dans le mode alphanumérique du QR code :
 * un QR très compact (25×25 modules) donc lisible même imprimé ou affiché en petit.
 */
export function genererJeton(): string {
  let bits = 0, val = 0, out = '';
  for (const x of randomBytes(16)) {
    val = (val << 8) | x;
    bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans O/0/I/1/L pour éviter les confusions

export function genererCode(longueur = 8): string {
  let s = '';
  for (let i = 0; i < longueur; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

export const genererMotDePasseTemporaire = () => genererCode(4) + '-' + genererCode(4);
