'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from './client';

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const charger = useCallback(async () => {
    if (!url) return;
    setChargement(true);
    try { setData(await api<T>(url)); setErreur(null); } catch (e) { setErreur((e as Error).message); }
    setChargement(false);
  }, [url]);
  useEffect(() => { charger(); }, [charger]);
  return { data, erreur, chargement, recharger: charger };
}
