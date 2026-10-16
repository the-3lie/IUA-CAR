import { cleMatricule, normaliser, type EtudiantScan, type Regle, type Resultat, type TypePassage } from './shared';

export type EtudiantLocal = EtudiantScan & { jeton: string; nom_n: string; cle: string };
export type DonneesListe = {
  cars: { id: number; nom: string }[];
  regle: Regle;
  etudiants: (EtudiantScan & { jeton: string })[];
  telecharge_le: string;
};
export type EntreeFile = {
  client_uid: string;
  jeton?: string;
  etudiant_id?: number;
  nom_saisi?: string;
  car_id: number;
  type: TypePassage;
  horodatage: string;
  resultat: Resultat;
  detail: string;
  doublon: boolean;
  nom: string;
  matricule?: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function ouvrir(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open('controle-car', 3);
      r.onupgradeneeded = (ev) => {
        const db = r.result;
        if (ev.oldVersion < 1) {
          const e = db.createObjectStore('etudiants', { keyPath: 'id' });
          e.createIndex('jeton', 'jeton', { unique: true });
          db.createObjectStore('meta');
          db.createObjectStore('file', { keyPath: 'client_uid' });
        }
        if (ev.oldVersion < 2) r.transaction!.objectStore('etudiants').createIndex('matricule', 'matricule', { unique: true });
        if (ev.oldVersion < 3) r.transaction!.objectStore('etudiants').createIndex('cle', 'cle');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => { dbPromise = null; reject(r.error); };
    });
  }
  return dbPromise;
}

const promesse = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

const fin = (t: IDBTransaction) =>
  new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

export async function enregistrerListe(d: DonneesListe) {
  const db = await ouvrir();
  const t = db.transaction(['etudiants', 'meta'], 'readwrite');
  const s = t.objectStore('etudiants');
  s.clear();
  for (const e of d.etudiants) s.put({ ...e, nom_n: normaliser(e.nom), cle: cleMatricule(e.matricule) } satisfies EtudiantLocal);
  const m = t.objectStore('meta');
  m.put(d.cars, 'cars');
  m.put(d.regle, 'regle');
  m.put({ nb: d.etudiants.length, telecharge_le: d.telecharge_le }, 'info');
  await fin(t);
}

export async function lireMeta<T>(cle: string): Promise<T | undefined> {
  const db = await ouvrir();
  return promesse<T | undefined>(db.transaction('meta').objectStore('meta').get(cle));
}

export async function etudiantParJeton(jeton: string): Promise<EtudiantLocal | undefined> {
  const db = await ouvrir();
  return promesse<EtudiantLocal | undefined>(db.transaction('etudiants').objectStore('etudiants').index('jeton').get(jeton));
}

export async function etudiantParMatricule(matricule: string): Promise<EtudiantLocal | undefined> {
  const db = await ouvrir();
  return promesse<EtudiantLocal | undefined>(db.transaction('etudiants').objectStore('etudiants').index('matricule').get(matricule));
}

/** Même logique que le serveur : match exact du matricule, sinon match souple (tirets, espaces). */
export async function etudiantParCandidats(candidats: string[]): Promise<EtudiantLocal | undefined> {
  for (const c of candidats) { const e = await etudiantParMatricule(c); if (e) return e; }
  const db = await ouvrir();
  for (const c of candidats) {
    const e = await promesse<EtudiantLocal | undefined>(db.transaction('etudiants').objectStore('etudiants').index('cle').get(cleMatricule(c)));
    if (e) return e;
  }
  return undefined;
}

export async function etudiantParId(id: number): Promise<EtudiantLocal | undefined> {
  const db = await ouvrir();
  return promesse<EtudiantLocal | undefined>(db.transaction('etudiants').objectStore('etudiants').get(id));
}

export async function rechercherLocal(q: string, limite = 15): Promise<EtudiantLocal[]> {
  const db = await ouvrir();
  const tout = await promesse<EtudiantLocal[]>(db.transaction('etudiants').objectStore('etudiants').getAll());
  const n = normaliser(q);
  const m = q.trim().toUpperCase();
  return tout.filter((e) => e.matricule.includes(m) || e.nom_n.includes(n)).sort((a, b) => a.nom.localeCompare(b.nom)).slice(0, limite);
}

export async function ajouterFile(e: EntreeFile) {
  const db = await ouvrir();
  const t = db.transaction('file', 'readwrite');
  t.objectStore('file').put(e);
  await fin(t);
}

export async function listerFile(): Promise<EntreeFile[]> {
  const db = await ouvrir();
  const tout = await promesse<EntreeFile[]>(db.transaction('file').objectStore('file').getAll());
  return tout.sort((a, b) => a.horodatage.localeCompare(b.horodatage));
}

export async function retirerDeFile(uids: string[]) {
  if (!uids.length) return;
  const db = await ouvrir();
  const t = db.transaction('file', 'readwrite');
  uids.forEach((u) => t.objectStore('file').delete(u));
  await fin(t);
}
