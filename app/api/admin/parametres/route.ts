import { z } from 'zod';
import { corps, route } from '@/lib/api';
import { getParametres, setParametre } from '@/lib/regle';
import { journaliser } from '@/lib/audit';

export const GET = route(['admin'], async () => getParametres());

const dateMD = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'Date invalide (format JJ/MM).');
const num = (nom: string) => z.number({ invalid_type_error: `${nom} : saisissez un nombre.` }).min(0, `${nom} : valeur négative.`).max(100_000_000);
const ordre = (s: string) => { const [m, d] = s.split('-').map(Number); return m * 100 + d; };

const schema = z
  .object({
    mode: z.enum(['paliers', 'pourcentage', 'montant']),
    valeur: num('Valeur'),
    activation: z.enum(['nom', 'code']),
    qr: z.enum(['matricule', 'jeton']),
    paliers: z.object({
      p1: num('Palier 1'), p2: num('Palier 2'), p3: num('Palier 3'),
      bascule1: dateMD, bascule2: dateMD, reinit: dateMD, proportionnel: z.boolean(),
    }).optional(),
  })
  .refine((d) => d.mode !== 'pourcentage' || d.valeur <= 100, { message: 'Un pourcentage ne peut pas dépasser 100.' })
  .refine((d) => !d.paliers || (d.paliers.p1 <= d.paliers.p2 && d.paliers.p2 <= d.paliers.p3), { message: 'Les paliers doivent être croissants (palier 1 ≤ palier 2 ≤ palier 3).' })
  .refine((d) => !d.paliers || (ordre(d.paliers.bascule2) < ordre(d.paliers.reinit) && ordre(d.paliers.reinit) < ordre(d.paliers.bascule1)), {
    message: 'Les dates doivent se suivre dans l’année : bascule vers le palier 3 (ex. 10/03), puis réinitialisation (ex. 01/07), puis bascule vers le palier 2 (ex. 10/12).',
  });

export const PUT = route(['admin'], async ({ req, session }) => {
  const d = await corps(req, schema);
  await setParametre('regle_mode', d.mode);
  await setParametre('regle_valeur', String(d.valeur));
  if (d.paliers) await setParametre('paliers', JSON.stringify(d.paliers));
  await setParametre('activation', d.activation);
  await setParametre('qr_mode', d.qr);
  await journaliser(session, 'parametres.modifie', `Règle : ${d.mode} ${d.mode === 'paliers' && d.paliers ? `${d.paliers.p1}/${d.paliers.p2}/${d.paliers.p3}` : d.valeur} · activation : ${d.activation} · QR : ${d.qr}`);
  return getParametres();
});
