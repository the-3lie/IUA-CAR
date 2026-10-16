'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Btn, Champ, Message } from '@/components/ui';
import { Marque } from '@/components/Marque';
import { api, ErreurApi } from '@/lib/client';

export default function Activation() {
  const [matricule, setMatricule] = useState('');
  const [verification, setVerification] = useState('');
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (mdp !== mdp2) return setErreur('Les deux mots de passe ne sont pas identiques.');
    setEnvoi(true);
    try {
      const r = await api<{ redirection: string }>('/api/auth/activation', {
        corps: { matricule, verification, mot_de_passe: mdp },
      });
      window.location.href = r.redirection;
    } catch (err) {
      setErreur((err as ErreurApi).message);
      setEnvoi(false);
    }
  }

  return (
    <main className="min-h-dvh">
      <div className="bg-encre px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]"><Marque clair /></div>
      <div className="livree h-2" />
      <div className="mx-auto max-w-md px-5 py-8">
        <h1 className="font-display text-3xl font-extrabold">Activer mon compte</h1>
        <p className="mt-2 text-encre-2">
          Une seule fois. Vous choisissez ensuite votre mot de passe pour les prochaines connexions.
        </p>
        <form onSubmit={soumettre} className="mt-6 space-y-4">
          <Champ label="Matricule" value={matricule} onChange={(e) => setMatricule(e.target.value)} autoCapitalize="characters" required />
          <Champ
            label="Votre nom ou code d’activation"
            aide="Nom tel qu’il figure sur la liste, ou le code remis par l’administration."
            value={verification}
            onChange={(e) => setVerification(e.target.value)}
            autoComplete="off"
            required
          />
          <Champ label="Choisissez un mot de passe" type="password" aide="6 caractères minimum." value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="new-password" required minLength={6} />
          <Champ label="Confirmez le mot de passe" type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} autoComplete="new-password" required />
          {erreur && <Message>{erreur}</Message>}
          <Btn type="submit" variante="jaune" grand chargement={envoi} className="w-full">Activer et me connecter</Btn>
        </form>
        <Link href="/connexion" className="mt-6 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
