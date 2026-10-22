// Génère exemple/etudiants-exemple.xlsx : un classeur, une feuille par car (npm run exemple)
import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';

const noms = [
  'KOUASSI Jean Marc', 'TRAORE Awa', 'KONE Ibrahim', 'YAO Marie-Claire', 'BAMBA Souleymane', 'N\'GUESSAN Adjoua',
  'DIALLO Mamadou', 'COULIBALY Fatoumata', 'OUATTARA Seydou', 'AKA Kouadio Serge', 'TANOH Estelle', 'SORO Yacouba',
  'KOFFI Amenan', 'DOSSO Aminata', 'GBAGBO Patrick', 'ZADI Rosine', 'BROU Alain', 'FOFANA Salimata', 'ADOU Cédric', 'SYLLA Kadidja',
];
let n = 0;
// « Montant » = total déjà payé ; SOLDE = reste à payer pour l'année (prix annuel = Montant + SOLDE).
const ligne = (nom, prixAnnuel, paye) => {
  n++;
  return [`IUA24${String(1000 + n)}`, nom, paye, prixAnnuel - paye];
};

const enTete = ['Matricule', 'Nom et Prénoms', 'Montant', 'SOLDE'];
const enTeteModalites = [...enTete, 'Tranche 1', 'Tranche 2', 'Tranche 3'];
const modalites = ['160 000 FCFA cumulés avant le 10/12', '310 000 FCFA cumulés avant le 10/03', '460 000 FCFA cumulés avant fin juin'];

// CAR 5 : 460 000 FCFA / an, avec modalités de paiement
const car5 = [enTeteModalites];
noms.slice(0, 7).forEach((nom, i) => car5.push([...ligne(nom, 460000, [460000, 460000, 310000, 160000, 0, 100000, 460000][i]), ...modalites]));
car5.push(['', '', '', '']);
car5.push(['TOTAL', '', 0, 0]);

// CAR 11 : car moins cher (300 000 FCFA / an), avec un doublon et une ligne sans matricule
const car11 = [enTete];
noms.slice(7, 13).forEach((nom, i) => car11.push(ligne(nom, 300000, [300000, 100000, 300000, 160000, 150000, 300000][i])));
car11.push([car11[1][0], car11[1][1], 300000, 0]); // doublon volontaire
car11.push(['', 'SANS MATRICULE Test', 300000, 0]); // erreur volontaire

// CAR 21 : colonne CAR explicite
const car21 = [[...enTete, 'CAR']];
noms.slice(13).forEach((nom, i) => car21.push([...ligne(nom, 460000, [460000, 310000, 100000, 460000, 160000, 0, 460000][i]), 'CAR 21']));

const wb = XLSX.utils.book_new();
for (const [nom, rows] of [['CAR 5', car5], ['CAR 11', car11], ['CAR 21', car21]]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, nom);
}
mkdirSync('exemple', { recursive: true });
XLSX.writeFile(wb, 'exemple/etudiants-exemple.xlsx');
console.log('exemple/etudiants-exemple.xlsx créé');
