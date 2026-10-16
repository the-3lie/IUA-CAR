'use client';
import { useEffect, useRef, useState } from 'react';

/** Caméra + lecture de QR (html5-qrcode). La caméra reste allumée : l'écran parent ignore les codes pendant un résultat. */
export default function Lecteur({ onCode }: { onCode: (texte: string) => void }) {
  const ref = useRef(onCode);
  ref.current = onCode;
  const [etat, setEtat] = useState<'demarrage' | 'pret' | 'refuse'>('demarrage');

  useEffect(() => {
    let annule = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;
    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (annule) return;
      scanner = new Html5Qrcode('lecteur', { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] });
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            aspectRatio: 1,
            qrbox: (w, h) => { const c = Math.floor(Math.min(w, h) * 0.72); return { width: c, height: c }; },
          },
          (texte) => ref.current(texte),
          () => {},
        );
        if (!annule) setEtat('pret');
      } catch {
        if (!annule) setEtat('refuse');
      }
    })();
    return () => {
      annule = true;
      const s = scanner;
      if (s) {
        Promise.resolve(s.isScanning ? s.stop() : undefined).then(() => s.clear()).catch(() => {});
      }
    };
  }, []);

  return (
    <div className="relative">
      <div id="lecteur" className="aspect-square w-full overflow-hidden rounded-2xl border-2 border-encre" />
      {etat === 'demarrage' && <p className="absolute inset-0 grid place-items-center text-white">Ouverture de la caméra…</p>}
      {etat === 'refuse' && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-encre p-6 text-center text-white">
          <p>
            Caméra inaccessible. Autorisez l’accès à la caméra dans votre navigateur, puis rechargez la page.
            En attendant, utilisez la recherche manuelle.
          </p>
        </div>
      )}
    </div>
  );
}
