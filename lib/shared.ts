/* Code partagé entre le serveur et le navigateur (aucune dépendance serveur). */

export type Regle = { mode: 'pourcentage' | 'montant'; valeur: number };
export type Statut = 'en_regle' | 'solde_a_payer' | 'non_solde';
export type Resultat = 'en_regle' | 'a_verifier' | 'non_solde' | 'non_inscrit' | 'invalide' | 'desactive';
export type TypePassage = 'montee' | 'descente';

export const REGLE_PAR_DEFAUT: Regle = { mode: 'pourcentage', valeur: 100 };

export const STATUT_LABEL: Record<Statut, string> = {
  en_regle: 'En règle',
  solde_a_payer: 'Solde à payer',
  non_solde: 'Non soldé',
};

export const RESULTAT_LABEL: Record<Resultat, string> = {
  en_regle: 'En règle',
  a_verifier: 'À vérifier',
  non_solde: 'Non soldé',
  non_inscrit: 'Non inscrit',
  invalide: 'QR invalide',
  desactive: 'Compte désactivé',
};

export const TYPE_LABEL: Record<TypePassage, string> = { montee: 'Montée', descente: 'Descente' };

export type EtudiantPaiement = { montant_du: number; total_paye: number; solde: number };

/** Statut de paiement d'un étudiant selon la règle d'accès réglée par l'administrateur. */
export function statutPaiement(e: EtudiantPaiement, regle: Regle): Statut {
  const paye = Number(e.total_paye) || 0;
  const du = Number(e.montant_du) || 0;
  let ok: boolean;
  if (regle.mode === 'montant') ok = paye >= regle.valeur && paye > 0;
  else ok = du > 0 ? paye >= (du * regle.valeur) / 100 - 0.001 : paye > 0;
  if (ok) return 'en_regle';
  return paye > 0 ? 'solde_a_payer' : 'non_solde';
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
 * et par le mode hors-ligne du contrôleur.
 */
export function evaluer(
  e: EtudiantScan,
  carScanId: number,
  regle: Regle,
  nomCar: (id: number | null) => string,
): Evaluation {
  if (!e.actif) return { resultat: 'desactive', detail: 'Compte désactivé par l’administration' };
  const statut = statutPaiement(e, regle);
  if (statut === 'non_solde') return { resultat: 'non_solde', detail: 'Aucun paiement enregistré' };
  const notes: string[] = [];
  let aVerifier = false;
  if (statut === 'solde_a_payer') {
    aVerifier = true;
    notes.push(`Solde restant : ${fcfa(e.solde)}`);
  }
  if (e.car_id !== carScanId) {
    aVerifier = true;
    notes.push(`Rattaché à ${e.car_id ? nomCar(e.car_id) : 'aucun car'}`);
  }
  if (aVerifier) return { resultat: 'a_verifier', detail: notes.join(' · ') };
  return { resultat: 'en_regle', detail: e.solde > 0 ? `Solde restant : ${fcfa(e.solde)}` : 'Solde à jour' };
}

export const PREFIXE_QR = 'CC1:';

export function jetonDepuisQr(contenu: string): string | null {
  const c = contenu.trim();
  if (!c.startsWith(PREFIXE_QR)) return null;
  const j = c.slice(PREFIXE_QR.length);
  return /^[A-Za-z0-9_-]{20,64}$/.test(j) ? j : null;
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
