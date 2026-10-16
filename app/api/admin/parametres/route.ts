import { z } from 'zod';
import { corps, route } from '@/lib/api';
import { getParametres, setParametre } from '@/lib/regle';
import { journaliser } from '@/lib/audit';

export const GET = route(['admin'], async () => getParametres());

const schema = z
  .object({
    mode: z.enum(['pourcentage', 'montant']),
    valeur: z.number({ invalid_type_error: 'Saisissez un nombre.' }).min(0, 'La valeur ne peut pas être négative.').max(100_000_000),
    activation: z.enum(['nom', 'code']),
    qr: z.enum(['matricule', 'jeton']),
  })
  .refine((d) => d.mode !== 'pourcentage' || d.valeur <= 100, { message: 'Un pourcentage ne peut pas dépasser 100.' });

export const PUT = route(['admin'], async ({ req, session }) => {
  const d = await corps(req, schema);
  await setParametre('regle_mode', d.mode);
  await setParametre('regle_valeur', String(d.valeur));
  await setParametre('activation', d.activation);
  await setParametre('qr_mode', d.qr);
  await journaliser(session, 'parametres.modifie', `Règle : ${d.mode} ${d.valeur} · activation : ${d.activation} · QR : ${d.qr}`);
  return getParametres();
});
