import { z } from 'zod';
import { ApiError, ConfigError } from './errors';
import { sessionCourante } from './session';
import type { Role, Session } from './jwt';
import { sql } from './db';

type Ctx = { req: Request; session: Session; params: Record<string, string> };
type Handler = (c: Ctx) => Promise<unknown>;
type RouteCtx = { params: Promise<any> };

function verifierOrigine(req: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, 'Origine non autorisée.');
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, 'Origine non autorisée.');
  }
}

async function compteActif(s: Session): Promise<boolean> {
  if (s.role === 'etudiant') {
    const r = await sql`SELECT 1 FROM etudiants WHERE id = ${s.uid} AND actif AND mot_de_passe_hash IS NOT NULL`;
    return r.length > 0;
  }
  const r = await sql`SELECT 1 FROM utilisateurs WHERE id = ${s.uid} AND actif AND role = ${s.role}`;
  return r.length > 0;
}

function reponseErreur(e: unknown): Response {
  if (e instanceof ApiError) return Response.json({ erreur: e.message, code: e.code }, { status: e.status });
  if (e instanceof ConfigError) {
    console.error('[config]', e.message);
    return Response.json({ erreur: `Configuration serveur incomplète : ${e.message}` }, { status: 500 });
  }
  console.error('[api]', e);
  return Response.json({ erreur: 'Erreur serveur. Réessayez dans un instant.' }, { status: 500 });
}

async function executer(req: Request, ctx: RouteCtx, roles: Role[] | null, fn: Handler): Promise<Response> {
  try {
    verifierOrigine(req);
    let session = null as unknown as Session;
    if (roles) {
      const s = await sessionCourante();
      if (!s) throw new ApiError(401, 'Session expirée. Reconnectez-vous.', 'session');
      if (!roles.includes(s.role)) throw new ApiError(403, 'Accès refusé.');
      if (!(await compteActif(s))) throw new ApiError(401, 'Compte désactivé ou introuvable.', 'session');
      session = s;
    }
    const params = ((await ctx?.params) ?? {}) as Record<string, string>;
    const out = await fn({ req, session, params });
    return out instanceof Response ? out : Response.json(out);
  } catch (e) {
    return reponseErreur(e);
  }
}

/** Route protégée : vérifie la session ET le rôle avant tout traitement. */
export function route(roles: Role[], fn: Handler) {
  return (req: Request, ctx: RouteCtx) => executer(req, ctx, roles, fn);
}

/** Route publique (connexion, activation). */
export function routePublique(fn: Handler) {
  return (req: Request, ctx: RouteCtx) => executer(req, ctx, null, fn);
}

export async function corps<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  const json = await req.json().catch(() => null);
  const r = schema.safeParse(json);
  if (!r.success) {
    const m = r.error.issues[0]?.message;
    throw new ApiError(400, m && !m.startsWith('Required') ? m : 'Données invalides.');
  }
  return r.data;
}

export function ipClient(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'inconnue';
}

export const entierId = (v: string) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, 'Identifiant invalide.');
  return n;
};
