'use client';
import { useEffect, useRef, useState } from 'react';
import { cx } from '@/components/ui';

/**
 * Lecteur de QR code continu et rapide, pensé pour les petits QR :
 * - toute l'image est analysée (pas de petite zone de visée), en haute résolution ;
 * - détecteur natif du téléphone (BarcodeDetector) quand il existe, sinon jsQR ;
 * - mise au point automatique continue, lampe et zoom si la caméra les propose.
 */
export default function Lecteur({ onCode }: { onCode: (texte: string) => void }) {
  const cb = useRef(onCode);
  cb.current = onCode;
  const video = useRef<HTMLVideoElement>(null);
  const piste = useRef<MediaStreamTrack | null>(null);
  const [etat, setEtat] = useState<'demarrage' | 'pret' | 'refuse'>('demarrage');
  const [flash, setFlash] = useState(false);
  const [lampe, setLampe] = useState<boolean | null>(null); // null = non disponible
  const [zoomMax, setZoomMax] = useState(1);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const v = video.current!;
    let fini = false;
    let occupe = false;
    let flux: MediaStream | null = null;
    let detecteur: any = null;
    let jsQR: ((d: Uint8ClampedArray, w: number, h: number, o?: object) => { data: string } | null) | null = null;
    let dernier = { texte: '', t: 0 };
    const toile = document.createElement('canvas');
    const ctx = toile.getContext('2d', { willReadFrequently: true })!;

    const trouve = (texte: string) => {
      const now = Date.now();
      if (texte === dernier.texte && now - dernier.t < 3000) return;
      dernier = { texte, t: now };
      setFlash(true);
      setTimeout(() => setFlash(false), 220);
      cb.current(texte);
    };

    const analyser = async () => {
      if (occupe || v.readyState < 2 || !v.videoWidth) return;
      occupe = true;
      try {
        if (detecteur) {
          const r = await detecteur.detect(v);
          if (r[0]?.rawValue) trouve(r[0].rawValue);
        } else if (jsQR) {
          const k = Math.min(1, 1280 / v.videoWidth);
          const w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
          toile.width = w; toile.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (r?.data) trouve(r.data);
        }
      } catch { /* image illisible : on passe à la suivante */ }
      occupe = false;
    };

    const boucle = () => {
      if (fini) return;
      analyser().finally(() => {
        if (fini) return;
        if ('requestVideoFrameCallback' in v) (v as any).requestVideoFrameCallback(boucle);
        else requestAnimationFrame(boucle);
      });
    };

    (async () => {
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        });
      } catch {
        if (!fini) setEtat('refuse');
        return;
      }
      if (fini) { flux.getTracks().forEach((t) => t.stop()); return; }
      const t = flux.getVideoTracks()[0];
      piste.current = t;
      try {
        const caps: any = t.getCapabilities?.() ?? {};
        if (caps.focusMode?.includes?.('continuous')) await t.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        if (caps.torch) setLampe(false);
        if (caps.zoom?.max > 1) setZoomMax(Math.min(caps.zoom.max, 4));
      } catch { /* options non supportées */ }

      v.srcObject = flux;
      await v.play().catch(() => {});

      const BD = (window as any).BarcodeDetector;
      if (BD) {
        try {
          const formats: string[] = (await BD.getSupportedFormats?.()) ?? ['qr_code'];
          if (formats.includes('qr_code')) detecteur = new BD({ formats: ['qr_code'] });
        } catch { /* repli sur jsQR */ }
      }
      if (!detecteur) jsQR = (await import('jsqr')).default as any;
      if (!fini) { setEtat('pret'); boucle(); }
    })();

    return () => {
      fini = true;
      flux?.getTracks().forEach((t) => t.stop());
      piste.current = null;
    };
  }, []);

  async function basculerLampe() {
    try {
      await piste.current?.applyConstraints({ advanced: [{ torch: !lampe } as any] });
      setLampe(!lampe);
    } catch { /* lampe indisponible */ }
  }

  async function changerZoom(z: number) {
    try {
      await piste.current?.applyConstraints({ advanced: [{ zoom: z } as any] });
      setZoom(z);
    } catch { /* zoom indisponible */ }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <video
        ref={video} playsInline muted autoPlay
        className={cx('aspect-[4/3] w-full border-4 bg-black object-cover transition-colors', flash ? 'border-car' : 'border-encre')}
      />
      <div className="pointer-events-none absolute inset-[16%] rounded-2xl border-2 border-white/50" aria-hidden />
      {etat === 'pret' && (lampe !== null || zoomMax > 1) && (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          {lampe !== null && (
            <button onClick={basculerLampe} aria-pressed={lampe} className={cx('min-h-11 rounded-full px-4 text-sm font-bold', lampe ? 'bg-car text-encre' : 'bg-black/60 text-white')}>
              Lampe
            </button>
          )}
          {zoomMax > 1 && [1, 2, 3].filter((z) => z <= zoomMax).map((z) => (
            <button key={z} onClick={() => changerZoom(z)} aria-pressed={zoom === z} className={cx('min-h-11 min-w-11 rounded-full px-3 text-sm font-bold', zoom === z ? 'bg-car text-encre' : 'bg-black/60 text-white')}>
              {z}×
            </button>
          ))}
        </div>
      )}
      {etat === 'demarrage' && <p className="absolute inset-0 grid place-items-center text-white">Ouverture de la caméra…</p>}
      {etat === 'refuse' && (
        <div className="absolute inset-0 grid place-items-center bg-encre p-6 text-center text-white">
          <p>Caméra inaccessible. Autorisez l’accès à la caméra dans votre navigateur (HTTPS requis), puis rechargez la page. En attendant, utilisez la recherche manuelle.</p>
        </div>
      )}
    </div>
  );
}
