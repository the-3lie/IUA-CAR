import { query, sql } from './db';
import { genererCode, genererJeton } from './codes';
import { normaliser, normaliserCar } from './shared';

export type LigneBrute = {
  feuille: string; ligne: number;
  matricule?: unknown; nom?: unknown; car?: unknown;
  montant?: unknown; paye?: unknown; solde?: unknown; modalites?: unknown;
};

export type LigneValide = {
  feuille: string; ligne: number; matricule: string; nom: string; car: string | null;
  montant_du: number; total_paye: number; solde: number; modalites: string | null;
};

export type Action = 'cree' | 'maj' | 'inchange';

export function parseMontant(v: unknown): number | null | 'invalide' {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 'invalide';
  let s = String(v).replace(/[\s\u00a0\u202f]/g, '').replace(/fcfa|cfa|f$/gi, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return 'invalide';
  return Number(s);
}

const texte = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

export async function analyser(lignes: LigneBrute[]) {
  const erreurs: { feuille: string; ligne: number; message: string }[] = [];
  const avertissements: string[] = [];
  const doublons: { matricule: string; emplacements: string[]; conserve: string }[] = [];
  const valides = new Map<string, LigneValide>();
  const vus = new Map<string, string[]>();
  let incoherences = 0;

  for (const l of lignes) {
    const lieu = `${l.feuille}, ligne ${l.ligne}`;
    const err = (message: string) => erreurs.push({ feuille: l.feuille, ligne: l.ligne, message });
    const matricule = texte(l.matricule).replace(/\s+/g, '').toUpperCase();
    const nom = texte(l.nom).replace(/\s+/g, ' ');
    if (!matricule) { err('Matricule manquant'); continue; }
    if (matricule.length > 40) { err('Matricule trop long'); continue; }
    if (!nom) { err(`Nom manquant (${matricule})`); continue; }
    const m = parseMontant(l.montant), p = parseMontant(l.paye), s = parseMontant(l.solde);
    if (m === 'invalide' || p === 'invalide' || s === 'invalide') { err(`Montant illisible (${matricule})`); continue; }
    if ([m, p, s].some((x) => typeof x === 'number' && x < 0)) { err(`Montant négatif (${matricule})`); continue; }
    // « Montant » = total DÉJÀ PAYÉ par l'étudiant (c'est lui que l'on compare aux paliers).
    // À défaut de colonne Montant, on retombe sur TOTPAYE.
    const paye = m ?? p ?? 0;
    const solde = s ?? 0;
    // Prix annuel = payé + reste à payer (SOLDE). Sans colonne SOLDE il est inconnu (0) : seuils standards, sans plafond.
    const du = s === null ? 0 : paye + s;
    if (m !== null && p !== null && Math.abs(m - p) > 1) {
      incoherences++;
      if (avertissements.length < 30) avertissements.push(`${matricule} (${lieu}) : Montant (${m}) ≠ TOTPAYE (${p}). Le Montant du fichier est conservé comme total payé.`);
    }

    const empl = vus.get(matricule);
    if (empl) { empl.push(lieu); continue; }
    vus.set(matricule, [lieu]);
    valides.set(matricule, {
      feuille: l.feuille, ligne: l.ligne, matricule, nom, car: normaliserCar(l.car),
      montant_du: du, total_paye: paye, solde, modalites: texte(l.modalites) || null,
    });
  }
  for (const [matricule, emplacements] of vus) {
    if (emplacements.length > 1) doublons.push({ matricule, emplacements, conserve: emplacements[0] });
  }

  const liste = [...valides.values()];
  const existants = liste.length
    ? await query<any>(
        `SELECT e.matricule, e.nom, c.nom AS car, e.montant_du, e.total_paye, e.solde, e.modalites
           FROM etudiants e LEFT JOIN cars c ON c.id = e.car_id WHERE e.matricule = ANY($1::text[])`,
        [liste.map((l) => l.matricule)],
      )
    : [];
  const exMap = new Map(existants.map((e) => [e.matricule as string, e]));
  const actions = new Map<string, Action>();
  for (const l of liste) {
    const e = exMap.get(l.matricule);
    if (!e) actions.set(l.matricule, 'cree');
    else {
      const meme =
        e.nom === l.nom && (l.car === null || e.car === l.car) && e.montant_du === l.montant_du &&
        e.total_paye === l.total_paye && e.solde === l.solde && (l.modalites === null || e.modalites === l.modalites);
      actions.set(l.matricule, meme ? 'inchange' : 'maj');
    }
  }
  const compte = (a: Action) => [...actions.values()].filter((x) => x === a).length;
  const carsDuFichier = new Map<string, number>();
  for (const l of liste) carsDuFichier.set(l.car ?? '(sans car)', (carsDuFichier.get(l.car ?? '(sans car)') ?? 0) + 1);
  const carsExistants = new Set((await sql<{ nom: string }>`SELECT nom FROM cars`).map((c) => c.nom));

  return {
    liste, actions,
    resume: {
      lignes_lues: lignes.length, valides: liste.length,
      crees: compte('cree'), mis_a_jour: compte('maj'), inchanges: compte('inchange'),
      erreurs: erreurs.length, doublons: doublons.length, incoherences,
      cars: [...carsDuFichier].map(([nom, nb]) => ({ nom, nb, nouveau: nom !== '(sans car)' && !carsExistants.has(nom) })),
    },
    erreurs: erreurs.slice(0, 200),
    doublons: doublons.slice(0, 100),
    avertissements,
    apercu: liste.slice(0, 100).map((l) => ({ ...l, action: actions.get(l.matricule)! })),
  };
}

export async function appliquer(liste: LigneValide[]) {
  const noms = [...new Set(liste.map((l) => l.car).filter((c): c is string => !!c))];
  if (noms.length) await query(`INSERT INTO cars (nom) SELECT unnest($1::text[]) ON CONFLICT (nom) DO NOTHING`, [noms]);
  const cars = await sql<{ id: number; nom: string }>`SELECT id, nom FROM cars`;
  const idCar = new Map(cars.map((c) => [c.nom, c.id]));
  const col = <T,>(f: (l: LigneValide) => T) => liste.map(f);
  await query(
    `INSERT INTO etudiants (matricule, nom, nom_normalise, car_id, montant_du, total_paye, solde, modalites, jeton_qr, code_activation)
     SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::int[], $5::float8[], $6::float8[], $7::float8[], $8::text[], $9::text[], $10::text[])
     ON CONFLICT (matricule) DO UPDATE SET
       nom = EXCLUDED.nom, nom_normalise = EXCLUDED.nom_normalise,
       car_id = COALESCE(EXCLUDED.car_id, etudiants.car_id),
       montant_du = EXCLUDED.montant_du, total_paye = EXCLUDED.total_paye, solde = EXCLUDED.solde,
       modalites = COALESCE(EXCLUDED.modalites, etudiants.modalites), maj_le = now()`,
    [
      col((l) => l.matricule), col((l) => l.nom), col((l) => normaliser(l.nom)),
      col((l) => (l.car ? idCar.get(l.car) ?? null : null)),
      col((l) => l.montant_du), col((l) => l.total_paye), col((l) => l.solde), col((l) => l.modalites),
      col(() => genererJeton()), col(() => genererCode()),
    ],
  );
}
