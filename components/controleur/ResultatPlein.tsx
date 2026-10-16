'use client';
import { useEffect } from 'react';
import { fcfa, RESULTAT_LABEL, type Resultat } from '@/lib/shared';

export type Affiche = {
  resultat: Resultat;
  detail: string;
  doublon: boolean;
  nom: string;
  matricule?: string;
  car?: string | null;
  solde?: number;
  horsLigne: boolean;
  seq: number;
};

const STYLE: Record<Resultat, { fond: string; texte: string; bouton: string }> = {
  en_regle: { fond: 'bg-ok', texte: 'text-white', bouton: 'bg-white text-ok' },
  a_verifier: { fond: 'bg-alerte', texte: 'text-encre', bouton: 'bg-encre text-white' },
  non_solde: { fond: 'bg-danger', texte: 'text-white', bouton: 'bg-white text-danger' },
  non_inscrit: { fond: 'bg-danger', texte: 'text-white', bouton: 'bg-white text-danger' },
  invalide: { fond: 'bg-danger', texte: 'text-white', bouton: 'bg-white text-danger' },
  desactive: { fond: 'bg-danger', texte: 'text-white', bouton: 'bg-white text-danger' },
};

export const DUREE_MS = 2000;

function bip(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = ok ? 880 : 220;
    o.type = ok ? 'sine' : 'square';
    g.gain.value = 0.15;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.12 : 0.35));
    setTimeout(() => ctx.close(), 600);
  } catch { /* son indisponible */ }
}

export default function ResultatPlein({ a, onFermer }: { a: Affiche; onFermer: () => void }) {
  const s = STYLE[a.resultat];
  const vert = a.resultat === 'en_regle' && !a.doublon;

  useEffect(() => {
    bip(vert);
    navigator.vibrate?.(vert ? 80 : [200, 80, 200]);
    const t = setTimeout(onFermer, DUREE_MS); // tout résultat se referme seul après 2 s
    return () => clearTimeout(t);
  }, [vert, onFermer]);

  return (
    <div role="alertdialog" aria-live="assertive" aria-label={RESULTAT_LABEL[a.resultat]} onClick={onFermer}
         className={`apparition fixed inset-0 z-50 flex flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] ${s.fond} ${s.texte}`}>
      <div className="flex flex-1 flex-col justify-center gap-4">
        <svg viewBox="0 0 24 24" className="size-24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {a.resultat === 'en_regle' ? <path d="M4 12.5l5 5L20 6.5" />
            : a.resultat === 'a_verifier' ? <path d="M12 4v10M12 19v.01" />
            : <path d="M6 6l12 12M18 6L6 18" />}
        </svg>
        <p className="font-display text-6xl font-extrabold leading-none">{RESULTAT_LABEL[a.resultat]}</p>
        <div>
          <p className="text-3xl font-bold leading-tight">{a.nom}</p>
          {a.matricule && <p className="nombres mt-1 text-xl opacity-90">{a.matricule}</p>}
        </div>
        {a.car !== undefined && <p className="text-2xl font-bold">{a.car ?? 'Aucun car'}</p>}
        {a.detail && <p className="text-xl font-semibold">{a.detail}</p>}
        {a.solde !== undefined && a.solde > 0 && a.resultat !== 'a_verifier' && a.resultat !== 'en_regle' && (
          <p className="text-xl font-semibold">Solde : {fcfa(a.solde)}</p>
        )}
        {a.doublon && (
          <p className="rounded-xl bg-black/25 px-4 py-3 text-lg font-bold">Déjà scanné il y a moins d’une minute.</p>
        )}
        {a.horsLigne && <p className="text-base font-medium opacity-90">Enregistré hors-ligne : synchronisation dès le retour du réseau.</p>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/25" aria-hidden>
        <div className="minuterie h-full rounded-full bg-current" style={{ animationDuration: `${DUREE_MS}ms` }} />
      </div>
      <p className="mt-3 text-center text-base font-semibold opacity-90">Scannez le suivant, ou touchez l’écran pour fermer</p>
    </div>
  );
}
