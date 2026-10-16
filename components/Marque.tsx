export function IconeCar({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect x="2" y="7" width="36" height="24" rx="5" fill="#ffc20e" />
      <rect x="2" y="23" width="36" height="2" fill="#0b1d33" />
      <rect x="6" y="11" width="8" height="8" rx="1.5" fill="#0b1d33" />
      <rect x="16" y="11" width="8" height="8" rx="1.5" fill="#0b1d33" />
      <rect x="26" y="11" width="8" height="8" rx="1.5" fill="#0b1d33" />
      <circle cx="12" cy="31" r="4" fill="#0b1d33" />
      <circle cx="28" cy="31" r="4" fill="#0b1d33" />
      <circle cx="12" cy="31" r="1.6" fill="#ffc20e" />
      <circle cx="28" cy="31" r="1.6" fill="#ffc20e" />
    </svg>
  );
}

export function Marque({ clair = false }: { clair?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <IconeCar />
      <span className={`font-display text-2xl font-extrabold tracking-tight ${clair ? 'text-white' : 'text-encre'}`}>
        Contrôle Car
      </span>
    </span>
  );
}
