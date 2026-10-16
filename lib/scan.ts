import { ApiError } from './errors';
import { query, sql } from './db';
import { getRegle } from './regle';
import {
  cleMatricule, evaluer, lireQr, statutPaiement,
  type Resultat, type Statut, type TypePassage,
} from './shared';

export type ScanEntree = {
  jeton?: string;
  etudiant_id?: number;
  nom_saisi?: string;
  car_id: number;
  type: TypePassage;
  client_uid: string;
  horodatage?: string;
};

export type EtudiantResume = {
  id: number; nom: string; matricule: string; car: string | null;
  montant_du: number; total_paye: number; solde: number; statut: Statut;
};

export type ScanSortie = {
  client_uid: string;
  passage_id: number | null;
  deja_enregistre: boolean;
  resultat: Resultat;
  detail: string;
  doublon: boolean;
  horodatage: string;
  etudiant: EtudiantResume | null;
  /** Matricule lu dans le QR quand il n'existe pas dans la base. */
  matricule_lu?: string;
};

const MINUTE = 60_000;

/** Un horodatage fourni par le téléphone (mode hors-ligne) est accepté s'il est plausible. */
function horodatageValide(h?: string): number {
  const now = Date.now();
  if (!h) return now;
  const t = Date.parse(h);
  if (!Number.isFinite(t) || t > now + 5 * MINUTE || t < now - 7 * 24 * 60 * MINUTE) return now;
  return t;
}

/**
 * Traite un lot de scans (1 pour un scan en ligne, jusqu'à 100 pour une synchronisation).
 * Le serveur recalcule toujours le résultat : le téléphone n'est jamais cru sur parole.
 */
export async function traiterLot(entrees: ScanEntree[], controleurId: number): Promise<ScanSortie[]> {
  if (entrees.length === 0) return [];
  const regle = await getRegle();
  const cars = await sql<{ id: number; nom: string }>`SELECT id, nom FROM cars`;
  const nomCar = (id: number | null) => cars.find((c) => c.id === id)?.nom ?? '—';
  for (const e of entrees) {
    if (!cars.some((c) => c.id === e.car_id)) throw new ApiError(400, 'Car inconnu. Rechargez la liste.');
  }

  const dejaVus = await query<any>(
    `SELECT client_uid, id, resultat, detail, doublon, horodatage, etudiant_id
       FROM passages WHERE client_uid = ANY($1::text[])`,
    [entrees.map((e) => e.client_uid)],
  );
  const dejaMap = new Map(dejaVus.map((r) => [r.client_uid as string, r]));

  const lus = entrees.map((e) => (e.jeton ? lireQr(e.jeton) : null));
  const jetons = lus.flatMap((q) => (q?.type === 'jeton' ? [q.jeton] : []));
  const matricules = lus.flatMap((q) => (q?.type === 'matricule' ? q.candidats : []));
  const cles = [...new Set(matricules.map(cleMatricule))];
  const ids = [
    ...entrees.map((e) => e.etudiant_id).filter((x): x is number => !!x),
    ...dejaVus.map((r) => r.etudiant_id).filter((x: unknown): x is number => !!x),
  ];
  const etudiants = await query<any>(
    `SELECT id, matricule, nom, car_id, montant_du, total_paye, solde, actif, jeton_qr
       FROM etudiants WHERE jeton_qr = ANY($1::text[]) OR id = ANY($2::int[]) OR matricule = ANY($3::text[])
          OR regexp_replace(matricule, '[^A-Z0-9]', '', 'g') = ANY($4::text[])`,
    [jetons, ids, matricules, cles],
  );
  const parJeton = new Map(etudiants.map((e) => [e.jeton_qr as string, e]));
  const parId = new Map(etudiants.map((e) => [e.id as number, e]));
  const parMatricule = new Map(etudiants.map((e) => [e.matricule as string, e]));
  const parCle = new Map<string, any>();
  for (const e of etudiants) if (!parCle.has(cleMatricule(e.matricule))) parCle.set(cleMatricule(e.matricule), e);
  /** Retrouve l'étudiant d'un QR de carte : match exact du matricule, sinon match « souple » (tirets, espaces). */
  const trouver = (cands: string[]) =>
    cands.map((c) => parMatricule.get(c)).find(Boolean) ?? cands.map((c) => parCle.get(cleMatricule(c))).find(Boolean);

  const resume = (e: any): EtudiantResume => ({
    id: e.id, nom: e.nom, matricule: e.matricule, car: e.car_id ? nomCar(e.car_id) : null,
    montant_du: e.montant_du, total_paye: e.total_paye, solde: e.solde, statut: statutPaiement(e, regle),
  });

  // Passages récents des étudiants concernés, pour repérer les doublons (même minute).
  const instants = entrees.map((e) => horodatageValide(e.horodatage));
  const ciblesIds = [...new Set(etudiants.map((e) => e.id as number).concat(ids))];
  const recents = ciblesIds.length
    ? await query<any>(
        `SELECT etudiant_id, type, horodatage FROM passages
          WHERE etudiant_id = ANY($1::int[]) AND annule = FALSE
            AND horodatage BETWEEN $2 AND $3`,
        [ciblesIds, new Date(Math.min(...instants) - MINUTE).toISOString(), new Date(Math.max(...instants) + MINUTE).toISOString()],
      )
    : [];
  const vus: { id: number; type: string; t: number }[] = recents.map((r) => ({
    id: r.etudiant_id, type: r.type, t: new Date(r.horodatage).getTime(),
  }));

  const sorties: (ScanSortie | null)[] = new Array(entrees.length).fill(null);
  const aInserer: { i: number; row: any[] }[] = [];

  const ordre = entrees.map((_, i) => i).sort((a, b) => instants[a] - instants[b]);
  for (const i of ordre) {
    const e = entrees[i];
    const t = instants[i];
    const existant = dejaMap.get(e.client_uid);
    if (existant) {
      const et = existant.etudiant_id ? parId.get(existant.etudiant_id) : null;
      sorties[i] = {
        client_uid: e.client_uid, passage_id: Number(existant.id), deja_enregistre: true,
        resultat: existant.resultat, detail: existant.detail ?? '', doublon: existant.doublon,
        horodatage: new Date(existant.horodatage).toISOString(), etudiant: et ? resume(et) : null,
      };
      continue;
    }

    let etudiant: any = null;
    let resultat: Resultat;
    let detail: string;
    let nomSaisi: string | null = null;

    let matriculeLu: string | undefined;

    if (e.jeton) {
      const q = lireQr(e.jeton);
      if (!q) {
        resultat = 'invalide'; detail = 'QR illisible : contenu non reconnu';
      } else if (q.type === 'jeton') {
        etudiant = parJeton.get(q.jeton);
        if (!etudiant) { resultat = 'invalide'; detail = 'QR inconnu ou périmé (régénéré)'; }
        else ({ resultat, detail } = evaluer(etudiant, e.car_id, regle, nomCar));
      } else {
        // Le QR contient un matricule : on le compare à la base.
        etudiant = trouver(q.candidats);
        if (!etudiant) {
          matriculeLu = q.matricule;
          nomSaisi = `Matricule ${q.matricule}`;
          resultat = 'non_inscrit';
          detail = `Matricule ${q.matricule} absent de la base`;
        } else ({ resultat, detail } = evaluer(etudiant, e.car_id, regle, nomCar));
      }
    } else if (e.etudiant_id) {
      etudiant = parId.get(e.etudiant_id);
      if (!etudiant) { resultat = 'invalide'; detail = 'Étudiant introuvable'; }
      else ({ resultat, detail } = evaluer(etudiant, e.car_id, regle, nomCar));
    } else {
      nomSaisi = (e.nom_saisi ?? '').trim().slice(0, 120) || 'Sans nom';
      resultat = 'non_inscrit';
      detail = 'Personne absente de la liste';
    }

    let doublon = false;
    if (etudiant) {
      doublon = vus.some((v) => v.id === etudiant.id && v.type === e.type && Math.abs(v.t - t) < MINUTE);
      vus.push({ id: etudiant.id, type: e.type, t });
    }

    const horodatage = new Date(t).toISOString();
    sorties[i] = {
      client_uid: e.client_uid, passage_id: null, deja_enregistre: false, resultat, detail, doublon, horodatage,
      etudiant: etudiant ? resume(etudiant) : null, matricule_lu: matriculeLu,
    };
    aInserer.push({
      i,
      row: [etudiant?.id ?? null, nomSaisi, e.car_id, e.type, resultat, detail, doublon, controleurId, e.client_uid, horodatage],
    });
  }

  if (aInserer.length) {
    const col = (n: number) => aInserer.map((x) => x.row[n]);
    const res = await query<{ id: string; client_uid: string }>(
      `INSERT INTO passages (etudiant_id, nom_saisi, car_id, type, resultat, detail, doublon, controleur_id, client_uid, horodatage)
       SELECT * FROM unnest($1::int[], $2::text[], $3::int[], $4::text[], $5::text[], $6::text[], $7::bool[], $8::int[], $9::text[], $10::timestamptz[])
       ON CONFLICT (client_uid) DO NOTHING
       RETURNING id, client_uid`,
      [col(0), col(1), col(2), col(3), col(4), col(5), col(6), col(7), col(8), col(9)],
    );
    const idParUid = new Map(res.map((r) => [r.client_uid, Number(r.id)]));
    for (const { i } of aInserer) {
      const s = sorties[i]!;
      const id = idParUid.get(s.client_uid);
      if (id) s.passage_id = id;
      else s.deja_enregistre = true; // course entre deux envois : déjà enregistré
    }
  }
  return sorties as ScanSortie[];
}
