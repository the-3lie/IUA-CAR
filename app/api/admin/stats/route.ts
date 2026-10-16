import { route } from '@/lib/api';
import { DEBUT_JOUR_SQL, query } from '@/lib/db';
import { condEnRegleSql, getRegle } from '@/lib/regle';

export const GET = route(['admin'], async () => {
  const regle = await getRegle();
  const ok = condEnRegleSql(regle, 'e');
  const [parCar, sansCar, jour, semaine, nonInscrits] = await Promise.all([
    query(
      `SELECT c.id, c.nom, COUNT(e.id)::int AS total, (COUNT(e.id) FILTER (WHERE ${ok}))::int AS en_regle
         FROM cars c LEFT JOIN etudiants e ON e.car_id = c.id AND e.actif
        GROUP BY c.id ORDER BY NULLIF(regexp_replace(c.nom, '[^0-9]', '', 'g'), '')::int NULLS LAST, c.nom`,
    ),
    query(`SELECT COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE ${ok}))::int AS en_regle FROM etudiants e WHERE e.car_id IS NULL AND e.actif`),
    query(
      `SELECT type, resultat, COUNT(*)::int AS n FROM passages
        WHERE annule = FALSE AND horodatage >= ${DEBUT_JOUR_SQL} GROUP BY type, resultat`,
    ),
    query(
      `SELECT to_char(d.jour, 'YYYY-MM-DD') AS jour, COALESCE(COUNT(p.id), 0)::int AS n
         FROM generate_series((now() AT TIME ZONE 'Africa/Abidjan')::date - 6, (now() AT TIME ZONE 'Africa/Abidjan')::date, interval '1 day') AS d(jour)
         LEFT JOIN passages p ON p.annule = FALSE AND (p.horodatage AT TIME ZONE 'Africa/Abidjan')::date = d.jour::date
        GROUP BY d.jour ORDER BY d.jour`,
    ),
    query(
      `SELECT COUNT(*) FILTER (WHERE horodatage >= ${DEBUT_JOUR_SQL})::int AS jour,
              COUNT(*)::int AS sept_jours
         FROM passages WHERE annule = FALSE AND resultat = 'non_inscrit' AND horodatage >= now() - interval '7 days'`,
    ),
  ]);
  const total = parCar.reduce((s: number, c: any) => s + c.total, 0) + (sansCar[0]?.total ?? 0);
  const enRegle = parCar.reduce((s: number, c: any) => s + c.en_regle, 0) + (sansCar[0]?.en_regle ?? 0);
  const passagesJour = {
    montee: jour.filter((r: any) => r.type === 'montee').reduce((s: number, r: any) => s + r.n, 0),
    descente: jour.filter((r: any) => r.type === 'descente').reduce((s: number, r: any) => s + r.n, 0),
    a_verifier: jour.filter((r: any) => ['a_verifier', 'non_solde'].includes(r.resultat)).reduce((s: number, r: any) => s + r.n, 0),
  };
  return {
    regle,
    total_etudiants: total,
    en_regle: enRegle,
    taux_en_regle: total ? Math.round((enRegle / total) * 1000) / 10 : 0,
    par_car: parCar,
    sans_car: sansCar[0] ?? { total: 0, en_regle: 0 },
    passages_jour: { ...passagesJour, total: passagesJour.montee + passagesJour.descente },
    semaine,
    non_inscrits: { jour: nonInscrits[0]?.jour ?? 0, sept_jours: nonInscrits[0]?.sept_jours ?? 0 },
  };
});
