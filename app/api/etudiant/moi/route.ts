import { route } from '@/lib/api';
import { sql } from '@/lib/db';
import { getParametres } from '@/lib/regle';
import { STATUT_LABEL, contenuQr, statutPaiement } from '@/lib/shared';

export const GET = route(['etudiant'], async ({ session }) => {
  const [rows, params, hist] = await Promise.all([
    sql<any>`SELECT e.matricule, e.nom, e.montant_du, e.total_paye, e.solde, e.modalites, e.jeton_qr, c.nom AS car
               FROM etudiants e LEFT JOIN cars c ON c.id = e.car_id WHERE e.id = ${session.uid}`,
    getParametres(),
    sql<any>`SELECT p.id, p.horodatage, p.type, p.resultat, c.nom AS car, u.nom AS controleur
               FROM passages p
               LEFT JOIN cars c ON c.id = p.car_id
               LEFT JOIN utilisateurs u ON u.id = p.controleur_id
              WHERE p.etudiant_id = ${session.uid} AND p.annule = FALSE
              ORDER BY p.horodatage DESC LIMIT 300`,
  ]);
  const e = rows[0];
  const statut = statutPaiement(e, params.regle);
  return {
    matricule: e.matricule,
    nom: e.nom,
    car: e.car,
    statut,
    statut_label: STATUT_LABEL[statut],
    montant_du: e.montant_du,
    total_paye: e.total_paye,
    solde: e.solde,
    modalites: e.modalites,
    qr: contenuQr(e, params.qr),
    historique: hist,
    maj: new Date().toISOString(),
  };
});
