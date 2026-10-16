// Génère exemple/etudiants-exemple.xlsx : un classeur, une feuille par car (npm run exemple)
import * as XLSX from 'xlsx';
import { mkdirSync } from 'node:fs';

const noms = [
  'KOUASSI Jean Marc', 'TRAORE Awa', 'KONE Ibrahim', 'YAO Marie-Claire', 'BAMBA Souleymane', 'N\'GUESSAN Adjoua',
  'DIALLO Mamadou', 'COULIBALY Fatoumata', 'OUATTARA Seydou', 'AKA Kouadio Serge', 'TANOH Estelle', 'SORO Yacouba',
  'KOFFI Amenan', 'DOSSO Aminata', 'GBAGBO Patrick', 'ZADI Rosine', 'BROU Alain', 'FOFANA Salimata', 'ADOU Cédric', 'SYLLA Kadidja',
];
const montantCar = 150000;
let n = 0;
const ligne = (prefixe, nom, paye) => {
  n++;
  const mat = `${prefixe}${String(1000 + n)}`;
  return [mat, nom, montantCar, paye, montantCar - paye];
};

const enTete = ['Matricule', 'Nom et Prénoms', 'Montant', 'TOTPAYE', 'SOLDE'];
const enTeteModalites = [...enTete, 'Tranche 1', 'Tranche 2', 'Echéance'];

// CAR 5 : avec modalités de paiement (tranches / échéances)
const car5 = [enTeteModalites];
noms.slice(0, 7).forEach((nom, i) => {
  const paye = [150000, 150000, 75000, 150000, 0, 100000, 150000][i];
  car5.push([...ligne('IUA24', nom, paye), '75 000 FCFA - 15/10/2026', '75 000 FCFA - 15/12/2026', '15/12/2026']);
});
car5.push(['', '', '', '', '']);
car5.push(['TOTAL', '', montantCar * 7, 0, 0]);

// CAR 11 : contient un doublon et une ligne sans matricule
const car11 = [enTete];
noms.slice(7, 13).forEach((nom, i) => car11.push(ligne('IUA24', nom, [150000, 50000, 150000, 150000, 100000, 150000][i])));
car11.push([car11[1][0], car11[1][1], montantCar, 150000, 0]); // doublon volontaire
car11.push(['', 'SANS MATRICULE Test', montantCar, 150000, 0]); // erreur volontaire

// CAR 21 : colonne CAR explicite
const car21 = [[...enTete, 'CAR']];
noms.slice(13).forEach((nom, i) => car21.push([...ligne('IUA24', nom, [150000, 150000, 25000, 150000, 150000, 0, 150000][i]), 'CAR 21']));

const wb = XLSX.utils.book_new();
for (const [nom, rows] of [['CAR 5', car5], ['CAR 11', car11], ['CAR 21', car21]]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, nom);
}
mkdirSync('exemple', { recursive: true });
XLSX.writeFile(wb, 'exemple/etudiants-exemple.xlsx');
console.log('exemple/etudiants-exemple.xlsx créé');
