import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { STATUT_LABEL, type Statut } from '@/lib/shared';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin size-5', className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type Variante = 'primaire' | 'jaune' | 'contour' | 'danger' | 'discret';
const VARIANTES: Record<Variante, string> = {
  primaire: 'bg-encre text-white hover:bg-[#12294a] active:bg-black',
  jaune: 'bg-car text-encre hover:bg-[#ffcd3a] active:bg-car-fonce',
  contour: 'bg-surface text-encre border-2 border-encre hover:bg-fond',
  danger: 'bg-danger text-white hover:bg-[#a81f26]',
  discret: 'bg-transparent text-encre-2 hover:bg-black/5 underline-offset-4',
};

export function Btn({
  variante = 'primaire', chargement, grand, className, children, disabled, ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; chargement?: boolean; grand?: boolean }) {
  return (
    <button
      {...p}
      disabled={disabled || chargement}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:opacity-50',
        grand ? 'min-h-14 px-6 text-lg' : 'min-h-12 px-4 text-base',
        VARIANTES[variante], className,
      )}
    >
      {chargement && <Spinner />}
      {children}
    </button>
  );
}

export function Champ({
  label, aide, erreur, className, id, ...p
}: InputHTMLAttributes<HTMLInputElement> & { label: string; aide?: string; erreur?: string }) {
  const ident = id ?? `champ-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div className={className}>
      <label htmlFor={ident} className="mb-1.5 block text-sm font-semibold">{label}</label>
      <input
        id={ident}
        {...p}
        className="min-h-12 w-full rounded-xl border-2 border-trait bg-surface px-3.5 text-base placeholder:text-encre-2/50 focus:border-encre focus:outline-none"
      />
      {aide && !erreur && <p className="mt-1 text-sm text-encre-2">{aide}</p>}
      {erreur && <p className="mt-1 text-sm font-medium text-danger">{erreur}</p>}
    </div>
  );
}

export function Selection({
  label, className, id, children, ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const ident = id ?? (label ? `sel-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className={className}>
      {label && <label htmlFor={ident} className="mb-1.5 block text-sm font-semibold">{label}</label>}
      <select
        id={ident}
        {...p}
        className="min-h-12 w-full rounded-xl border-2 border-trait bg-surface px-3 text-base focus:border-encre focus:outline-none"
      >
        {children}
      </select>
    </div>
  );
}

export function Message({ type = 'erreur', children }: { type?: 'erreur' | 'info' | 'succes' | 'attention'; children: ReactNode }) {
  const s = {
    erreur: 'bg-danger-clair text-danger border-danger/40',
    info: 'bg-white text-encre border-trait',
    succes: 'bg-ok-clair text-ok border-ok/40',
    attention: 'bg-alerte-clair text-alerte-texte border-alerte-texte/30',
  }[type];
  return (
    <div role={type === 'erreur' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-[15px] font-medium', s)}>
      {children}
    </div>
  );
}

const STATUT_STYLE: Record<Statut, string> = {
  en_regle: 'bg-ok text-white',
  solde_a_payer: 'bg-alerte text-encre',
  non_solde: 'bg-danger text-white',
};

export function PastilleStatut({ statut, className }: { statut: Statut; className?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-3 py-1 text-sm font-bold', STATUT_STYLE[statut], className)}>
      {STATUT_LABEL[statut]}
    </span>
  );
}

export function Carte({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-2xl border border-trait bg-surface', className)}>{children}</section>;
}

export function Vide({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-encre-2">{children}</p>;
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-encre-2">
      <Spinner /> {texte}
    </div>
  );
}
