/* Code partagé entre le serveur et le navigateur (aucune dépendance serveur). */

/** Paliers de paiement cumulés, selon la date. Les dates sont au format « MM-JJ » (ex. '12-10' = 10 décembre). */
export type Paliers = {
  p1: number; p2: number; p3: number;
  bascule1: string; // à partir de cette date : palier 2
  bascule2: string; // à partir de cette date : palier 3
  reinit: string;   // à partir de cette date : retour au palier 1 (nouvelle année)
  proportionnel: boolean; // cars moins chers : paliers proportionnels au montant (sinon : plafonnés au montant)
};
export const PALIERS_PAR_DEFAUT: Paliers = { p1: 160000, p2: 310000, p3: 460000, bascule1: '12-10', bascule2: '03-10', reinit: '07-01', proportionnel: false };

export type Regle = { mode: 'paliers' | 'pourcentage' | 'montant'; valeur: number; paliers: Paliers };
export type Statut = 'en_regle' | 'solde_a_payer' | 'non_solde';
export type Resultat = 'en_regle' | 'a_verifier' | 'non_solde' | 'non_inscrit' | 'invalide' | 'desactive';
export type TypePassage = 'montee' | 'descente';

export const REGLE_PAR_DEFAUT: Regle = { mode: 'paliers', valeur: 100, paliers: PALIERS_PAR_DEFAUT };

export const STATUT_LABEL: Record<Statut, string> = {
  en_regle: 'À jour',
  solde_a_payer: 'Pas à jour',
  non_solde: 'Aucun paiement',
};

export const RESULTAT_LABEL: Record<Resultat, string> = {
  en_regle: 'À jour',
  a_verifier: 'À vérifier',
  non_solde: 'Pas à jour',
  non_inscrit: 'Non inscrit',
  invalide: 'QR invalide',
  desactive: 'Compte désactivé',
};

export const TYPE_LABEL: Record<TypePassage, string> = { montee: 'Montée', descente: 'Descente' };

export type EtudiantPaiement = { montant_du: number; total_paye: number; solde: number };

const md = (s: string) => { const [m, d] = s.split('-').map(Number); return m * 100 + d; };

/** Palier cumulé exigé à la date donnée (fuseau Abidjan = UTC, sans changement d'heure). */
export function palierRequis(p: Paliers, date: Date = new Date()): number {
  const j = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  if (j >= md(p.bascule1) || j < md(p.bascule2)) return p.p2;
  if (j < md(p.reinit)) return p.p3;
  return p.p1;
}

/** Montant que l'étudiant doit avoir payé (cumul) pour être « à jour » à la date donnée. */
export function montantRequis(e: Pick<EtudiantPaiement, 'montant_du'>, regle: Regle, date: Date = new Date()): number {
  const du = Number(e.montant_du) || 0;
  if (regle.mode === 'montant') return regle.valeur;
  if (regle.mode === 'pourcentage') return du > 0 ? (du * regle.valeur) / 100 : 0;
  const pal = palierRequis(regle.paliers, date);
  if (du <= 0) return pal;
  if (regle.paliers.proportionnel && du < regle.paliers.p3) return (du * pal) / regle.paliers.p3;
  return Math.min(du, pal); // un car moins cher : le montant du fichier plafonne l'exigence
}

/** Soldé = tout ce qui est dû pour l'année est payé (plafonné au dernier palier). */
export function estSolde(e: EtudiantPaiement, regle: Regle): boolean {
  const paye = Number(e.total_paye) || 0;
  const du = Number(e.montant_du) || 0;
  if (paye <= 0) return false;
  if (du <= 0) return (Number(e.solde) || 0) <= 0;
  const cible = regle.mode === 'paliers' ? Math.min(du, regle.paliers.p3) : du;
  return paye >= cible - 0.001;
}

/** Statut de paiement d'un étudiant selon la règle d'accès réglée par l'administrateur. */
export function statutPaiement(e: EtudiantPaiement, regle: Regle, date: Date = new Date()): Statut {
  const paye = Number(e.total_paye) || 0;
  if (paye > 0 && paye >= montantRequis(e, regle, date) - 0.001) return 'en_regle';
  return paye > 0 ? 'solde_a_payer' : 'non_solde';
}

/** Prochaine échéance qui relève le montant exigé (null si aucune ou si la règle n'est pas à paliers). */
export function prochainPalier(e: Pick<EtudiantPaiement, 'montant_du'>, regle: Regle, date: Date = new Date()): { date: string; montant: number } | null {
  if (regle.mode !== 'paliers') return null;
  const p = regle.paliers;
  const y = date.getUTCFullYear();
  const actuel = montantRequis(e, regle, date);
  const jours: Date[] = [];
  for (const yy of [y, y + 1]) for (const s of [p.bascule1, p.bascule2, p.reinit]) {
    const [m, d] = s.split('-').map(Number);
    jours.push(new Date(Date.UTC(yy, m - 1, d)));
  }
  jours.sort((a, b) => a.getTime() - b.getTime());
  const aujourdhui = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
  for (const j of jours) {
    if (j.getTime() <= aujourdhui) continue;
    const m = montantRequis(e, regle, j);
    if (m > actuel + 0.001) return { date: j.toISOString().slice(0, 10), montant: m };
  }
  return null;
}

export function fcfa(n: number | string | null | undefined): string {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' FCFA';
}

/** Minuscules, sans accents, mots séparés par une espace. */
export function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Le nom saisi correspond-il au nom de la liste (insensible à l'ordre, aux accents et à la casse) ? */
export function nomCorrespond(saisi: string, liste: string): boolean {
  const a = normaliser(saisi).split(' ').filter(Boolean);
  const b = normaliser(liste).split(' ').filter(Boolean);
  if (a.length === 0 || b.length === 0) return false;
  if (a.length < 2 && b.length >= 2) return false;
  const inB = a.every((m) => b.includes(m));
  const bInA = b.every((m) => a.includes(m));
  return inB || bInA;
}

export type EtudiantScan = {
  id: number;
  matricule: string;
  nom: string;
  car_id: number | null;
  montant_du: number;
  total_paye: number;
  solde: number;
  actif: boolean;
};

export type Evaluation = { resultat: Resultat; detail: string };

/**
 * Cœur de la décision de contrôle. Utilisé à l'identique par le serveur
 * et par le mode hors-ligne du contrôleur. `date` = moment du scan.
 */
export function evaluer(
  e: EtudiantScan,
  carScanId: number,
  regle: Regle,
  nomCar: (id: number | null) => string,
  date: Date = new Date(),
): Evaluation {
  if (!e.actif) return { resultat: 'desactive', detail: 'Compte désactivé par l’administration' };
  const paye = Number(e.total_paye) || 0;
  const autreCar = e.car_id !== carScanId ? `Rattaché à ${e.car_id ? nomCar(e.car_id) : 'aucun car'}` : null;
  if (paye <= 0) return { resultat: 'non_solde', detail: 'Pas à jour : aucun paiement enregistré' };
  const requis = montantRequis(e, regle, date);
  if (paye < requis - 0.001) {
    const notes = [`Pas à jour : ${fcfa(paye)} payés, ${fcfa(requis)} requis (manque ${fcfa(requis - paye)})`];
    if (autreCar) notes.push(autreCar);
    return { resultat: 'a_verifier', detail: notes.join(' · ') };
  }
  if (autreCar) return { resultat: 'a_verifier', detail: autreCar };
  if (estSolde(e, regle)) return { resultat: 'en_regle', detail: 'Soldé' };
  return { resultat: 'en_regle', detail: `À jour · reste ${fcfa(Math.max(0, Number(e.solde) || 0))} pour l’année` };
}

/** Titre affiché en grand : « Soldé », « À jour », « Pas à jour », « À vérifier »… */
export function titreResultat(r: Resultat, detail: string): string {
  if (r === 'en_regle') return detail.startsWith('Soldé') ? 'Soldé' : 'À jour';
  if (r === 'a_verifier') return detail.startsWith('Pas à jour') ? 'Pas à jour' : 'À vérifier';
  return RESULTAT_LABEL[r];
}

export const PREFIXE_QR = 'CC1:';

export function jetonDepuisQr(contenu: string): string | null {
  const c = contenu.trim();
  if (!c.startsWith(PREFIXE_QR)) return null;
  const j = c.slice(PREFIXE_QR.length);
  return /^[A-Za-z0-9_-]{20,64}$/.test(j) ? j : null;
}

export type QrLu =
  | { type: 'jeton'; jeton: string }
  | { type: 'matricule'; matricule: string; candidats: string[] };

/** Clé de comparaison d'un matricule : majuscules, sans tirets, points, barres ni espaces. */
export const cleMatricule = (m: string) => m.toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Extrait les matricules possibles d'un QR de carte : le texte entier, ou chacun de ses morceaux
 * (cas d'un lien « …?mat=IUA241001 », d'un texte « NOM;IUA241001 », etc.). Le premier qui existe en base gagne.
 */
function candidatsMatricule(c: string): string[] {
  const vus = new Set<string>();
  const out: string[] = [];
  const ajouter = (t: string, exigerChiffre: boolean) => {
    const m = t.replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9._\/-]{1,39}$/.test(m) || (exigerChiffre && !/\d/.test(m)) || vus.has(m)) return;
    vus.add(m);
    out.push(m);
  };
  ajouter(c, false);
  for (const t of c.split(/[\s,;|:=?&#"'()\[\]{}<>\\/]+/)) if (t.length >= 3) ajouter(t, true);
  return out.slice(0, 12);
}

/**
 * Interprète le contenu brut d'un QR code :
 * - « CC1:… » = jeton sécurisé ;
 * - sinon, le texte est lu comme un MATRICULE (majuscules, sans espaces) à comparer à la base ;
 * - null si le contenu ne ressemble à rien d'exploitable (URL, texte long, etc.).
 */
export function lireQr(contenu: string): QrLu | null {
  const c = contenu.trim();
  if (!c) return null;
  const j = jetonDepuisQr(c);
  if (j) return { type: 'jeton', jeton: j };
  if (c.toUpperCase().startsWith(PREFIXE_QR)) return null;
  const candidats = candidatsMatricule(c);
  if (!candidats.length) return null;
  return { type: 'matricule', matricule: candidats.find((x) => /\d/.test(x)) ?? candidats[0], candidats };
}

export type ModeQr = 'matricule' | 'jeton';

/** Ce qui est écrit dans le QR code de l'étudiant, selon le réglage de l'administrateur. */
export function contenuQr(e: { matricule: string; jeton_qr: string }, mode: ModeQr): string {
  return mode === 'matricule' ? e.matricule : PREFIXE_QR + e.jeton_qr;
}

export function formatHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan' });
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Abidjan',
  });
}
export function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Abidjan',
  });
}

/** Normalise un nom de car : « car 5 », « 5 » → « CAR 5 ». */
export function normaliserCar(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/\s+/g, ' ');
  if (!s) return null;
  if (/^\d+$/.test(s)) s = `CAR ${s}`;
  const m = s.match(/^car\s*[-:n°]*\s*(\d+)$/i);
  if (m) return `CAR ${m[1]}`;
  return s.toUpperCase();
}
