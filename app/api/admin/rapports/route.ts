import * as XLSX from 'xlsx';
import { ApiError } from '@/lib/errors';
import { route } from '@/lib/api';
import { query } from '@/lib/db';
import { condEnRegleSql, getRegle } from '@/lib/regle';
import { RESULTAT_LABEL, STATUT_LABEL, TYPE_LABEL, formatDateHeure, statutPaiement } from '@/lib/shared';

const TYPES = ['passages', 'non_inscrits', 'paiements_incomplets', 'doublons', 'etudiants_non_en_regle', 'codes_activation'] as const;
type TypeRapport = (typeof TYPES)[number];
const LIMITE_ECRAN = 200;
const LIMITE_EXPORT = 50000;

const TITRES: Record<TypeRapport, string> = {
  passages: 'Historique des passages',
  non_inscrits: 'Non-inscrits repérés',
  paiements_incomplets: 'Passages avec paiement incomplet',
  doublons: 'Doublons de scan',
  etudiants_non_en_regle: 'Étudiants non en règle',
  codes_activation: 'Codes d’activation (comptes non activés)',
};

const dateOk = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

export const maxDuration = 60;

export const GET = route(['admin'], async ({ req }) => {
  const u = new URL(req.url).searchParams;
  const type = (u.get('type') ?? 'passages') as TypeRapport;
  if (!TYPES.includes(type)) throw new ApiError(400, 'Type de rapport inconnu.');
  const exporter = u.get('format') === 'xlsx';
  const limite = exporter ? LIMITE_EXPORT : LIMITE_ECRAN;
  const regle = await getRegle();
  let colonnes: string[];
  let lignes: (string | number)[][];
  let total: number;

  if (type === 'etudiants_non_en_regle' || type === 'codes_activation') {
    const where = type === 'codes_activation'
      ? `e.mot_de_passe_hash IS NULL AND e.code_activation IS NOT NULL AND e.actif`
      : `NOT ${condEnRegleSql(regle, 'e')} AND e.actif`;
    const p: unknown[] = [];
    const car = u.get('car');
    const w = [where];
    if (car && /^\d+$/.test(car)) { p.push(Number(car)); w.push(`e.car_id = $${p.length}`); }
    const cond = w.join(' AND ');
    total = (await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM etudiants e WHERE ${cond}`, p))[0].n;
    const rows = await query<any>(
      `SELECT e.matricule, e.nom, c.nom AS car, e.montant_du, e.total_paye, e.solde, e.code_activation
         FROM etudiants e LEFT JOIN cars c ON c.id = e.car_id WHERE ${cond} ORDER BY c.nom NULLS LAST, e.nom LIMIT ${limite}`,
      p,
    );
    if (type === 'codes_activation') {
      colonnes = ['Matricule', 'Nom et prénoms', 'Car', 'Code d’activation'];
      lignes = rows.map((r) => [r.matricule, r.nom, r.car ?? '', r.code_activation]);
    } else {
      colonnes = ['Matricule', 'Nom et prénoms', 'Car', 'Montant dû', 'Total payé', 'Solde', 'Statut'];
      lignes = rows.map((r) => [r.matricule, r.nom, r.car ?? '', r.montant_du, r.total_paye, r.solde, STATUT_LABEL[statutPaiement(r, regle)]]);
    }
  } else {
    const w: string[] = [];
    const p: unknown[] = [];
    const add = (cond: (n: number) => string, v: unknown) => { p.push(v); w.push(cond(p.length)); };
    if (u.get('annules') !== '1') w.push('p.annule = FALSE');
    const du = dateOk(u.get('du')), au = dateOk(u.get('au'));
    if (du) add((n) => `p.horodatage >= ($${n}::date)::timestamp AT TIME ZONE 'Africa/Abidjan'`, du);
    if (au) add((n) => `p.horodatage < (($${n}::date) + 1)::timestamp AT TIME ZONE 'Africa/Abidjan'`, au);
    const car = u.get('car'); if (car && /^\d+$/.test(car)) add((n) => `p.car_id = $${n}`, Number(car));
    const ctl = u.get('controleur'); if (ctl && /^\d+$/.test(ctl)) add((n) => `p.controleur_id = $${n}`, Number(ctl));
    const res = u.get('resultat'); if (res && res in RESULTAT_LABEL) add((n) => `p.resultat = $${n}`, res);
    if (type === 'non_inscrits') w.push(`p.resultat = 'non_inscrit'`);
    if (type === 'paiements_incomplets') w.push(`p.resultat IN ('a_verifier','non_solde')`);
    if (type === 'doublons') w.push('p.doublon = TRUE');
    const cond = w.length ? `WHERE ${w.join(' AND ')}` : '';
    total = (await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM passages p ${cond}`, p))[0].n;
    const rows = await query<any>(
      `SELECT p.horodatage, e.matricule, COALESCE(e.nom, p.nom_saisi, '') AS nom, c.nom AS car, p.type, p.resultat,
              p.detail, p.doublon, p.annule, ct.nom AS controleur
         FROM passages p
         LEFT JOIN etudiants e ON e.id = p.etudiant_id
         LEFT JOIN cars c ON c.id = p.car_id
         LEFT JOIN utilisateurs ct ON ct.id = p.controleur_id
         ${cond} ORDER BY p.horodatage DESC LIMIT ${limite}`,
      p,
    );
    colonnes = ['Date et heure', 'Matricule', 'Nom', 'Car', 'Type', 'Résultat', 'Détail', 'Doublon', 'Annulé', 'Contrôleur'];
    lignes = rows.map((r) => [
      formatDateHeure(r.horodatage), r.matricule ?? '', r.nom, r.car ?? '', TYPE_LABEL[r.type as 'montee' | 'descente'],
      RESULTAT_LABEL[r.resultat as keyof typeof RESULTAT_LABEL], r.detail ?? '', r.doublon ? 'Oui' : '', r.annule ? 'Oui' : '', r.controleur ?? '',
    ]);
  }

  if (!exporter) return { titre: TITRES[type], colonnes, lignes, total, tronque: total > lignes.length };

  const ws = XLSX.utils.aoa_to_sheet([colonnes, ...lignes]);
  ws['!cols'] = colonnes.map((c, i) => ({ wch: Math.min(40, Math.max(c.length + 2, ...lignes.slice(0, 200).map((l) => String(l[i] ?? '').length + 2))) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TITRES[type].slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const nom = `controle-car_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nom}"`,
      'Cache-Control': 'no-store',
    },
  });
});
