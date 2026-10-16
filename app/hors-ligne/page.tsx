export const metadata = { title: 'Hors-ligne' };

export default function HorsLigne() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-6">
      <h1 className="font-display text-3xl font-extrabold">Vous êtes hors-ligne</h1>
      <p className="text-encre-2">
        Cette page n’a pas encore été ouverte avec du réseau. Reconnectez-vous une première fois : ensuite votre QR code
        et la liste du car restent disponibles sans connexion.
      </p>
    </main>
  );
}
