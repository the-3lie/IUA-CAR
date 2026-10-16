import { sql } from './db';
import { REGLE_PAR_DEFAUT, type Regle } from './shared';

export type Parametres = { regle: Regle; activation: 'nom' | 'code' };

export async function getParametres(): Promise<Parametres> {
  const rows = await sql<{ cle: string; valeur: string }>`SELECT cle, valeur FROM parametres`;
  const m = Object.fromEntries(rows.map((r) => [r.cle, r.valeur]));
  const valeur = Number(m.regle_valeur);
  const regle: Regle = {
    mode: m.regle_mode === 'montant' ? 'montant' : 'pourcentage',
    valeur: Number.isFinite(valeur) && m.regle_valeur !== undefined ? valeur : REGLE_PAR_DEFAUT.valeur,
  };
  return { regle, activation: m.activation === 'code' ? 'code' : 'nom' };
}

export async function getRegle(): Promise<Regle> {
  return (await getParametres()).regle;
}

export async function setParametre(cle: string, valeur: string) {
  await sql`INSERT INTO parametres (cle, valeur) VALUES (${cle}, ${valeur})
            ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`;
}

/** Condition SQL « étudiant en règle » (la valeur est un nombre validé, jamais une saisie brute). */
export function condEnRegleSql(r: Regle, a = 'e'): string {
  const v = Number(r.valeur);
  if (!Number.isFinite(v)) throw new Error('Règle invalide');
  if (r.mode === 'montant') return `(${a}.total_paye >= ${v} AND ${a}.total_paye > 0)`;
  return `(CASE WHEN ${a}.montant_du > 0 THEN ${a}.total_paye >= ${a}.montant_du * ${v} / 100 - 0.001 ELSE ${a}.total_paye > 0 END)`;
}
