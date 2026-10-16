'use client';
import { useEffect, useState } from 'react';
import { Btn, Champ, Message, Spinner } from '@/components/ui';
import { api } from '@/lib/client';
import { rechercherLocal } from '@/lib/offline';

type Trouve = { id: number; matricule: string; nom: string; car_id: number | null; actif: boolean };

export default function Recherche({
  nomCar, onChoisir, onNonInscrit, onFermer,
}: {
  nomCar: (id: number | null) => string;
  onChoisir: (id: number) => void;
  onNonInscrit: (nom: string) => void;
  onFermer: () => void;
}) {
  const [q, setQ] = useState('');
  const [liste, setListe] = useState<Trouve[]>([]);
  const [attente, setAttente] = useState(false);
  const [mode, setMode] = useState<'recherche' | 'non_inscrit'>('recherche');
  const [nom, setNom] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) { setListe([]); return; }
    setAttente(true);
    const t = setTimeout(async () => {
      try {
        if (navigator.onLine) setListe((await api<{ etudiants: Trouve[] }>('/api/controleur/recherche?q=' + encodeURIComponent(q), { delai: 5000 })).etudiants);
        else setListe(await rechercherLocal(q));
      } catch {
        setListe(await rechercherLocal(q).catch(() => []));
      }
      setAttente(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Recherche manuelle" className="fixed inset-0 z-40 flex flex-col bg-fond">
      <div className="flex items-center justify-between bg-encre px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
        <h2 className="font-display text-xl font-extrabold">{mode === 'recherche' ? 'Recherche manuelle' : 'Personne non inscrite'}</h2>
        <button onClick={onFermer} className="min-h-11 rounded-lg px-3 font-semibold underline underline-offset-4">Fermer</button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        {mode === 'recherche' ? (
          <>
            <Champ label="Matricule ou nom" value={q} onChange={(e) => setQ(e.target.value)} autoFocus autoComplete="off" />
            <div className="mt-4 space-y-2">
              {attente && <p className="flex items-center gap-2 text-encre-2"><Spinner /> Recherche…</p>}
              {!attente && q.trim().length >= 2 && liste.length === 0 && <Message type="info">Aucun étudiant trouvé. Si la personne monte sans être sur la liste, enregistrez-la comme non inscrite.</Message>}
              {liste.map((e) => (
                <button key={e.id} onClick={() => onChoisir(e.id)} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 border-trait bg-surface px-4 py-2 text-left active:border-encre">
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{e.nom}</span>
                    <span className="nombres text-sm text-encre-2">{e.matricule}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-car px-2.5 py-1 text-sm font-bold">{nomCar(e.car_id)}</span>
                </button>
              ))}
            </div>
            <Btn variante="contour" grand className="mt-8 w-full" onClick={() => setMode('non_inscrit')}>Personne absente de la liste</Btn>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-encre-2">Saisissez le nom de la personne. Elle sera enregistrée comme « Non inscrit » et apparaîtra dans les rapports.</p>
            <Champ label="Nom de la personne" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus autoComplete="off" />
            <Btn variante="danger" grand className="w-full" disabled={nom.trim().length < 2} onClick={() => onNonInscrit(nom.trim())}>Enregistrer comme non inscrit</Btn>
            <Btn variante="discret" className="w-full" onClick={() => setMode('recherche')}>Retour à la recherche</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
