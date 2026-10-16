import { z } from 'zod';
import { corps, route } from '@/lib/api';
import { analyser, appliquer } from '@/lib/import';
import { journaliser } from '@/lib/audit';

const schema = z.object({
  mode: z.enum(['apercu', 'valider']),
  fichier: z.string().max(200).optional(),
  lignes: z
    .array(
      z.object({
        feuille: z.string().max(120),
        ligne: z.number().int(),
        matricule: z.any(), nom: z.any(), car: z.any(),
        montant: z.any(), paye: z.any(), solde: z.any(), modalites: z.any(),
      }),
    )
    .min(1, 'Le fichier ne contient aucune ligne exploitable.')
    .max(20000, 'Fichier trop volumineux (20 000 lignes maximum).'),
});

export const maxDuration = 60;

export const POST = route(['admin'], async ({ req, session }) => {
  const { mode, lignes, fichier } = await corps(req, schema);
  const a = await analyser(lignes);
  if (mode === 'valider') {
    if (a.liste.length === 0) return { ...a, liste: undefined, actions: undefined, applique: false };
    await appliquer(a.liste);
    const r = a.resume;
    await journaliser(
      session, 'import.excel',
      `${fichier ?? 'fichier'} : ${r.crees} créés, ${r.mis_a_jour} mis à jour, ${r.inchanges} inchangés, ${r.erreurs} erreurs, ${r.doublons} doublons`,
    );
  }
  return { resume: a.resume, erreurs: a.erreurs, doublons: a.doublons, avertissements: a.avertissements, apercu: a.apercu, applique: mode === 'valider' };
});
