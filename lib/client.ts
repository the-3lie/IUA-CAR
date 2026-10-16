'use client';

export class ErreurApi extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api<T = any>(url: string, opts: { method?: string; corps?: unknown; delai?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const minuteur = opts.delai ? setTimeout(() => ctrl.abort(), opts.delai) : null;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.corps !== undefined ? 'POST' : 'GET'),
      headers: opts.corps !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.corps !== undefined ? JSON.stringify(opts.corps) : undefined,
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } catch {
    throw new ErreurApi('Connexion impossible. Vérifiez votre réseau.', 0, 'reseau');
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && data?.code === 'session' && typeof window !== 'undefined') {
      if (!navigator.onLine) throw new ErreurApi('Hors-ligne.', 0, 'reseau');
      window.location.href = '/connexion';
    }
    throw new ErreurApi(data?.erreur ?? 'Une erreur est survenue.', res.status, data?.code);
  }
  return data as T;
}

/** Déconnexion : efface le cookie ET toutes les données stockées sur l'appareil. */
export async function deconnecter() {
  try { await fetch('/api/auth/deconnexion', { method: 'POST' }); } catch { /* hors-ligne : on nettoie quand même */ }
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('cc_')).forEach((k) => localStorage.removeItem(k));
    indexedDB.deleteDatabase('controle-car');
    if ('caches' in window) (await caches.keys()).forEach((k) => caches.delete(k));
  } catch { /* ignore */ }
  window.location.href = '/connexion';
}
