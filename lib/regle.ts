import { sql } from './db';
import { PALIERS_PAR_DEFAUT, palierRequis, type Paliers, type Regle } from './shared';

export type Parametres = { regle: Regle; activation: 'nom' | 'code'; qr: 'matricule' | 'jeton' };

const dateMD = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function lirePaliers(brut: string | undefined): Paliers {
  try {
    const j = JSON.parse(brut ?? 'null');
    const nombre = (v: unknown, defaut: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : defaut);
    const date = (v: unknown, defaut: string) => (typeof v === 'string' && dateMD.test(v) ? v : defaut);
    const d = PALIERS_PAR_DEFAUT;
    return {
      p1: nombre(j?.p1, d.p1), p2: nombre(j?.p2, d.p2), p3: nombre(j?.p3, d.p3),
      bascule1: date(j?.bascule1, d.bascule1), bascule2: date(j?.bascule2, d.bascule2), reinit: date(j?.reinit, d.reinit),
      proportionnel: j?.proportionnel === true,
    };
  } catch {
    return { ...PALIERS_PAR_DEFAUT };
  }
}

export async function getParametres(): Promise<Parametres> {
  const rows = await sql<{ cle: string; valeur: string }>`SELECT cle, valeur FROM parametres`;
  const m = Object.fromEntries(rows.map((r) => [r.cle, r.valeur]));
  const valeur = Number(m.regle_valeur);
  const regle: Regle = {
    mode: m.regle_mode === 'montant' ? 'montant' : m.regle_mode === 'pourcentage' ? 'pourcentage' : 'paliers',
    valeur: Number.isFinite(valeur) && m.regle_valeur !== undefined ? valeur : 100,
    paliers: lirePaliers(m.paliers),
  };
  return { regle, activation: m.activation === 'code' ? 'code' : 'nom', qr: m.qr_mode === 'jeton' ? 'jeton' : 'matricule' };
}

export async function getRegle(): Promise<Regle> {
  return (await getParametres()).regle;
}

export async function setParametre(cle: string, valeur: string) {
  await sql`INSERT INTO parametres (cle, valeur) VALUES (${cle}, ${valeur})
            ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`;
}

const nb = (x: number) => {
  const v = Number(x);
  if (!Number.isFinite(v)) throw new Error('Règle invalide');
  return String(v);
};

/** Montant requis (cumul payé) en SQL, identique à `montantRequis` côté JS. Les valeurs inlinées sont des nombres validés. */
export function requisSql(r: Regle, a = 'e', date: Date = new Date()): string {
  if (r.mode === 'montant') return nb(r.valeur);
  if (r.mode === 'pourcentage') return `(${a}.montant_du * ${nb(r.valeur)} / 100)`;
  const pal = nb(palierRequis(r.paliers, date));
  const normal = `(CASE WHEN ${a}.montant_du > 0 THEN LEAST(${a}.montant_du, ${pal}) ELSE ${pal} END)`;
  if (!r.paliers.proportionnel) return normal;
  const p3 = nb(r.paliers.p3);
  return `(CASE WHEN ${a}.montant_du > 0 AND ${a}.montant_du < ${p3} THEN ${a}.montant_du * ${pal} / ${p3} ELSE ${normal} END)`;
}

/** Condition SQL « étudiant à jour » à la date donnée (par défaut maintenant). */
export function condEnRegleSql(r: Regle, a = 'e', date: Date = new Date()): string {
  return `(${a}.total_paye > 0 AND ${a}.total_paye >= ${requisSql(r, a, date)} - 0.001)`;
}
