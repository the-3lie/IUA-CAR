import { ApiError } from '@/lib/errors';
import { corps, route } from '@/lib/api';
import { traiterLot } from '@/lib/scan';
import { schemaScan } from '@/lib/schemas';

export const POST = route(['controleur'], async ({ req, session }) => {
  const entree = await corps(req, schemaScan);
  // En ligne, l'heure du serveur fait foi.
  const [sortie] = await traiterLot([{ ...entree, horodatage: undefined }], session.uid);
  if (!sortie) throw new ApiError(500, 'Scan non enregistré.');
  return sortie;
});
