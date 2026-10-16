import { z } from 'zod';
import { ApiError } from '@/lib/errors';
import { corps, entierId, route } from '@/lib/api';
import { sql } from '@/lib/db';
import { getRegle } from '@/lib/regle';
import { PREFIXE_QR, normaliserCar, statutPaiement } from '@/lib/shared';
import { journaliser } from '@/lib/audit';

export const GET = route(['admin'], async ({ params }) => {
  const id = entierId(params.id);
  const regle = await getRegle();
  const rows = await sql<any>`SELECT e.*, c.nom AS car FROM etudiants e LEFT JOIN cars c ON c.id = e.car_id WHERE e.id = ${id}`;
  const e = rows[0];
  if (!e) throw new ApiError(404, 'Étudiant introuvable.');
  const passages = await sql`
    SELECT p.id, p.horodatage, p.type, p.resultat, p.detail, p.doublon, p.annule, c.nom AS car, u.nom AS controleur
      FROM passages p LEFT JOIN cars c ON c.id = p.car_id LEFT JOIN utilisateurs u ON u.id = p.controleur_id
     WHERE p.etudiant_id = ${id} ORDER BY p.horodatage DESC LIMIT 50`;
  return {
    id: e.id, matricule: e.matricule, nom: e.nom, car: e.car, actif: e.actif,
    active: !!e.mot_de_passe_hash, date_activation: e.date_activation,
    code_activation: e.mot_de_passe_hash ? null : e.code_activation,
    montant_du: e.montant_du, total_paye: e.total_paye, solde: e.solde, modalites: e.modalites,
    statut: statutPaiement(e, regle), qr: PREFIXE_QR + e.jeton_qr, passages,
  };
});

const patch = z.object({ car: z.string().trim().max(40).nullable().optional(), actif: z.boolean().optional() });

export const PATCH = route(['admin'], async ({ req, params, session }) => {
  const id = entierId(params.id);
  const d = await corps(req, patch);
  const rows = await sql<any>`SELECT matricule FROM etudiants WHERE id = ${id}`;
  if (!rows[0]) throw new ApiError(404, 'Étudiant introuvable.');
  const mat = rows[0].matricule;
  if (d.car !== undefined) {
    const nom = normaliserCar(d.car);
    if (!nom) await sql`UPDATE etudiants SET car_id = NULL, maj_le = now() WHERE id = ${id}`;
    else {
      const c = await sql<{ id: number }>`INSERT INTO cars (nom) VALUES (${nom}) ON CONFLICT (nom) DO UPDATE SET nom = EXCLUDED.nom RETURNING id`;
      await sql`UPDATE etudiants SET car_id = ${c[0].id}, maj_le = now() WHERE id = ${id}`;
    }
    await journaliser(session, 'etudiant.car', `${mat} → ${nom ?? 'aucun car'}`);
  }
  if (d.actif !== undefined) {
    await sql`UPDATE etudiants SET actif = ${d.actif}, maj_le = now() WHERE id = ${id}`;
    await journaliser(session, d.actif ? 'etudiant.reactive' : 'etudiant.desactive', mat);
  }
  return { ok: true };
});
