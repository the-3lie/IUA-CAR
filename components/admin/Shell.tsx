'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Marque } from '@/components/Marque';
import { cx } from '@/components/ui';
import { deconnecter } from '@/lib/client';

const LIENS = [
  { href: '/admin', texte: 'Tableau de bord' },
  { href: '/admin/import', texte: 'Import Excel' },
  { href: '/admin/etudiants', texte: 'Étudiants' },
  { href: '/admin/controleurs', texte: 'Contrôleurs' },
  { href: '/admin/rapports', texte: 'Rapports' },
  { href: '/admin/parametres', texte: 'Paramètres' },
  { href: '/admin/journal', texte: 'Journal' },
];

export default function Shell({ nom, children }: { nom: string; children: React.ReactNode }) {
  const chemin = usePathname();
  const actif = (h: string) => (h === '/admin' ? chemin === '/admin' : chemin.startsWith(h));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      {/* Bureau : barre latérale */}
      <aside className="hidden flex-col justify-between bg-encre p-5 text-white lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <div>
          <Marque clair />
          <nav className="mt-8 flex flex-col gap-1" aria-label="Administration">
            {LIENS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={actif(l.href) ? 'page' : undefined}
                className={cx(
                  'rounded-lg border-l-4 px-3 py-2.5 font-semibold',
                  actif(l.href) ? 'border-car bg-white/10' : 'border-transparent text-white/75 hover:bg-white/5',
                )}
              >
                {l.texte}
              </Link>
            ))}
          </nav>
        </div>
        <div>
          <p className="text-sm text-white/60">Connecté : {nom}</p>
          <button onClick={deconnecter} className="mt-1 min-h-11 font-semibold underline underline-offset-4">Déconnexion</button>
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile : barre du haut + onglets défilants */}
        <header className="sticky top-0 z-20 bg-encre text-white lg:hidden">
          <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Marque clair />
            <button onClick={deconnecter} className="min-h-11 px-1 text-sm font-semibold underline underline-offset-4">Déconnexion</button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Administration">
            {LIENS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={actif(l.href) ? 'page' : undefined}
                className={cx('shrink-0 rounded-full px-4 py-2 text-sm font-semibold', actif(l.href) ? 'bg-car text-encre' : 'bg-white/10')}
              >
                {l.texte}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
