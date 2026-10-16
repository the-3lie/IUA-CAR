import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { ConfigError } from './errors';

export type Row = Record<string, any>;

type Client = ReturnType<typeof neon>;
let client: Client | null = null;
let prete: Promise<void> | null = null;

function getClient(): Client {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new ConfigError('DATABASE_URL est manquante (voir .env.example).');
    client = neon(url);
  }
  return client;
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Une erreur SQL (code SQLSTATE) n'est pas réessayée ; une erreur réseau/réveil de Neon, oui. */
function estErreurSql(e: unknown): boolean {
  const code = (e as { code?: unknown })?.code;
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code);
}

/** Neon met la base en veille : la première requête peut échouer ou être lente. On réessaie proprement. */
async function avecReessai<T>(fn: () => Promise<T>): Promise<T> {
  const delais = [500, 1200, 2500, 4000];
  let derniere: unknown;
  for (let i = 0; i <= delais.length; i++) {
    try {
      return await fn();
    } catch (e) {
      derniere = e;
      if (estErreurSql(e) || e instanceof ConfigError || i === delais.length) break;
      await attendre(delais[i]);
    }
  }
  throw derniere;
}

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS utilisateurs (
    id SERIAL PRIMARY KEY,
    identifiant TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL,
    mot_de_passe_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','controleur')),
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS cars (
    id SERIAL PRIMARY KEY,
    nom TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS etudiants (
    id SERIAL PRIMARY KEY,
    matricule TEXT NOT NULL UNIQUE,
    nom TEXT NOT NULL,
    nom_normalise TEXT NOT NULL,
    car_id INTEGER REFERENCES cars(id) ON DELETE SET NULL,
    montant_du DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_paye DOUBLE PRECISION NOT NULL DEFAULT 0,
    solde DOUBLE PRECISION NOT NULL DEFAULT 0,
    modalites TEXT,
    jeton_qr TEXT NOT NULL UNIQUE,
    code_activation TEXT,
    mot_de_passe_hash TEXT,
    actif BOOLEAN NOT NULL DEFAULT TRUE,
    date_activation TIMESTAMPTZ,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    maj_le TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_etudiants_car ON etudiants(car_id)`,
  `CREATE INDEX IF NOT EXISTS idx_etudiants_nom ON etudiants(nom_normalise)`,
  `CREATE TABLE IF NOT EXISTS passages (
    id BIGSERIAL PRIMARY KEY,
    etudiant_id INTEGER REFERENCES etudiants(id) ON DELETE SET NULL,
    nom_saisi TEXT,
    car_id INTEGER REFERENCES cars(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('montee','descente')),
    resultat TEXT NOT NULL CHECK (resultat IN ('en_regle','a_verifier','non_solde','non_inscrit','invalide','desactive')),
    detail TEXT,
    doublon BOOLEAN NOT NULL DEFAULT FALSE,
    annule BOOLEAN NOT NULL DEFAULT FALSE,
    controleur_id INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
    client_uid TEXT UNIQUE,
    horodatage TIMESTAMPTZ NOT NULL DEFAULT now(),
    synchronise_le TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_passages_horodatage ON passages(horodatage DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_passages_etudiant ON passages(etudiant_id, horodatage DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_passages_controleur ON passages(controleur_id, horodatage DESC)`,
  `CREATE TABLE IF NOT EXISTS parametres (
    cle TEXT PRIMARY KEY,
    valeur TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS journal (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    utilisateur_id INTEGER,
    utilisateur_nom TEXT,
    detail TEXT,
    cree_le TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tentatives (
    cle TEXT PRIMARY KEY,
    nb INTEGER NOT NULL DEFAULT 0,
    debut TIMESTAMPTZ NOT NULL DEFAULT now(),
    bloque_jusqua TIMESTAMPTZ
  )`,
];

async function brut<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  return avecReessai(() => getClient().query(text, params as any[]) as unknown as Promise<T[]>);
}

async function initialiser(): Promise<void> {
  // La dernière table sert de témoin : si elle existe, tout le schéma est en place.
  const temoin = await brut(`SELECT to_regclass('public.tentatives') AS t`);
  if (!temoin[0]?.t) {
    for (const stmt of SCHEMA) await brut(stmt);
  }
  await creerAdmin();
}

/** Crée le compte administrateur initial ; ADMIN_PASSWORD fait foi à chaque démarrage. */
async function creerAdmin(): Promise<void> {
  const identifiant = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const motDePasse = process.env.ADMIN_PASSWORD || '';
  if (!identifiant || !motDePasse) return;
  const rows = await brut(`SELECT id, mot_de_passe_hash FROM utilisateurs WHERE identifiant = $1`, [identifiant]);
  if (rows.length === 0) {
    const hash = await bcrypt.hash(motDePasse, 10);
    await brut(
      `INSERT INTO utilisateurs (identifiant, nom, mot_de_passe_hash, role) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (identifiant) DO NOTHING`,
      [identifiant, 'Administrateur', hash],
    );
  } else if (!(await bcrypt.compare(motDePasse, rows[0].mot_de_passe_hash))) {
    const hash = await bcrypt.hash(motDePasse, 10);
    await brut(`UPDATE utilisateurs SET mot_de_passe_hash = $1, role = 'admin', actif = TRUE WHERE id = $2`, [hash, rows[0].id]);
  }
}

/** Les tables se créent toutes seules au premier appel (une seule fois par instance serveur). */
export async function assurerSchema(): Promise<void> {
  if (!prete) {
    prete = initialiser().catch(async (e) => {
      // Deux instances qui démarrent en même temps peuvent se marcher dessus : on retente une fois.
      prete = null;
      await attendre(400);
      prete = initialiser();
      try {
        await prete;
      } catch (e2) {
        prete = null;
        throw e2;
      }
      void e;
    });
  }
  return prete;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  await assurerSchema();
  return brut<T>(text, params);
}

/** Gabarit SQL : sql`SELECT * FROM x WHERE id = ${id}` (valeurs toujours paramétrées). */
export async function sql<T = Row>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  let text = '';
  strings.forEach((s, i) => {
    text += s;
    if (i < values.length) text += `$${i + 1}`;
  });
  return query<T>(text, values);
}

/** Début de la journée courante (Abidjan, UTC+0) sous forme d'expression SQL. */
export const DEBUT_JOUR_SQL = `(date_trunc('day', now() AT TIME ZONE 'Africa/Abidjan') AT TIME ZONE 'Africa/Abidjan')`;
