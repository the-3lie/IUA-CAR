'use client';
/* Lecture des fiches Excel / CSV dans le navigateur (le serveur ne reçoit que des lignes JSON). */
import type { LigneBrute } from './import';
import { normaliserCar } from './shared';

export type ResumeFeuille = { fichier: string; feuille: string; lignes: number; car: string | null; ignoree?: string };

const cle = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function colonne(h: string): keyof LigneBrute | 'modalite' | null {
  if (['matricule', 'mat', 'nmatricule', 'numeromatricule'].includes(h)) return 'matricule';
  if (['nometprenoms', 'nomprenoms', 'nometprenom', 'nomprenom', 'nom', 'etudiant', 'nomcomplet', 'nomsetprenoms'].includes(h)) return 'nom';
  if (['montant', 'montantdu', 'montanttotal', 'montantapayer', 'totaldu'].includes(h)) return 'montant';
  if (['totpaye', 'totalpaye', 'paye', 'montantpaye', 'totpayes', 'totalpaie'].includes(h)) return 'paye';
  if (['solde', 'resteapayer', 'reste', 'soldeapayer'].includes(h)) return 'solde';
  if (['car', 'bus', 'numerocar', 'ncar'].includes(h)) return 'car';
  if (/^(modalit|tranche|echeance)/.test(h)) return 'modalite';
  return null;
}

function carDepuisNom(s: string): string | null {
  const m = s.match(/(?:car|bus)\s*[-_n°:]*\s*(\d+)/i);
  if (m) return `CAR ${m[1]}`;
  if (/^\s*\d+\s*$/.test(s)) return normaliserCar(s);
  return null;
}

function parseCsv(texte: string): string[][] {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? '';
  const delim = [';', '\t', ','].map((d) => [d, premiere.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const lignes: string[][] = [];
  let cell = '', ligne: string[] = [], guillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (guillemets) {
      if (c === '"' && texte[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') guillemets = false;
      else cell += c;
    } else if (c === '"') guillemets = true;
    else if (c === delim) { ligne.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i++;
      ligne.push(cell); cell = '';
      lignes.push(ligne); ligne = [];
    } else cell += c;
  }
  if (cell || ligne.length) { ligne.push(cell); lignes.push(ligne); }
  return lignes;
}

function decoderCsv(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('\uFFFD') ? new TextDecoder('windows-1252').decode(buf) : utf8.replace(/^\uFEFF/, '');
}

function extraire(rows: unknown[][], fichier: string, feuille: string): { lignes: LigneBrute[]; resume: ResumeFeuille } {
  let entete = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    if (rows[i].some((c) => colonne(cle(c)) === 'matricule')) { entete = i; break; }
  }
  const base = { fichier, feuille, lignes: 0, car: null as string | null };
  if (entete < 0) return { lignes: [], resume: { ...base, ignoree: 'Colonne « Matricule » introuvable' } };

  const idx: Partial<Record<keyof LigneBrute, number>> = {};
  const modalites: { i: number; titre: string }[] = [];
  rows[entete].forEach((c, i) => {
    const k = colonne(cle(c));
    if (k === 'modalite') modalites.push({ i, titre: String(c).trim() });
    else if (k && idx[k] === undefined) idx[k] = i;
  });
  if (idx.nom === undefined) return { lignes: [], resume: { ...base, ignoree: 'Colonne « Nom et Prénoms » introuvable' } };

  const carParDefaut = carDepuisNom(feuille) ?? carDepuisNom(fichier);
  const label = `${fichier} › ${feuille}`.slice(0, 120);
  const lignes: LigneBrute[] = [];
  for (let r = entete + 1; r < rows.length; r++) {
    const row = rows[r];
    const get = (k: keyof LigneBrute) => (idx[k] === undefined ? undefined : row[idx[k]!]);
    const matricule = get('matricule'), nom = get('nom');
    const vide = (v: unknown) => v === undefined || v === null || String(v).trim() === '';
    if (vide(matricule) && vide(nom)) continue;
    if (/^total/.test(cle(matricule)) || /^total/.test(cle(nom))) continue;
    const mod = modalites
      .map((m) => (vide(row[m.i]) ? '' : `${m.titre} : ${String(row[m.i]).trim()}`))
      .filter(Boolean).join('\n');
    lignes.push({
      feuille: label, ligne: r + 1, matricule, nom,
      car: vide(get('car')) ? carParDefaut : get('car'),
      montant: get('montant'), paye: get('paye'), solde: get('solde'), modalites: mod || undefined,
    });
  }
  return { lignes, resume: { ...base, lignes: lignes.length, car: idx.car !== undefined ? '(colonne CAR)' : carParDefaut } };
}

export async function lireFichiers(fichiers: File[]): Promise<{ lignes: LigneBrute[]; feuilles: ResumeFeuille[] }> {
  const lignes: LigneBrute[] = [];
  const feuilles: ResumeFeuille[] = [];
  const XLSX = await import('xlsx');
  for (const f of fichiers) {
    const buf = await f.arrayBuffer();
    if (/\.csv$/i.test(f.name)) {
      const r = extraire(parseCsv(decoderCsv(buf)), f.name, 'CSV');
      lignes.push(...r.lignes); feuilles.push(r.resume);
      continue;
    }
    const wb = XLSX.read(buf, { type: 'array' });
    for (const nom of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], { header: 1, raw: true, defval: '', blankrows: false });
      const r = extraire(rows, f.name, nom);
      lignes.push(...r.lignes); feuilles.push(r.resume);
    }
  }
  return { lignes, feuilles };
}
