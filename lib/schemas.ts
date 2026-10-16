import { z } from 'zod';

export const schemaScan = z
  .object({
    jeton: z.string().max(200).optional(),
    etudiant_id: z.number().int().positive().optional(),
    nom_saisi: z.string().trim().min(2, 'Saisissez au moins 2 caractères.').max(120).optional(),
    car_id: z.number().int().positive(),
    type: z.enum(['montee', 'descente']),
    client_uid: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/),
    horodatage: z.string().max(40).optional(),
  })
  .refine((s) => [s.jeton, s.etudiant_id, s.nom_saisi].filter((v) => v !== undefined).length === 1, {
    message: 'Fournissez un QR, un étudiant ou un nom.',
  });
