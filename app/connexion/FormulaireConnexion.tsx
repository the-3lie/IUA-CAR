'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Btn, Champ, Message, cx } from '@/components/ui';
import { Marque } from '@/components/Marque';
import { api, ErreurApi } from '@/lib/client';

export default function FormulaireConnexion() {
  const [espace, setEspace] = useState<'etudiant' | 'personnel'>('etudiant');
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState<ErreurApi | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      const r = await api<{ redirection: string }>('/api/auth/connexion', {
        corps: { identifiant, mot_de_passe: mdp, espace },
      });
      window.location.href = r.redirection;
    } catch (err) {
      setErreur(err as ErreurApi);
      setEnvoi(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between bg-encre p-12 text-white lg:flex">
        <Marque clair />
        <div className="max-w-md">
          <p className="font-display text-5xl font-extrabold leading-[1.05]">
            Montez dans le car avec votre QR, rien d’autre.
          </p>
          <p className="mt-5 text-lg text-white/75">
            Le contrôleur scanne, le résultat s’affiche en une seconde : en règle, à vérifier ou non inscrit.
          </p>
        </div>
        <div className="livree h-3 w-full rounded-full" />
      </aside>

      <section className="flex flex-col">
        <div className="bg-encre px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
          <Marque clair />
        </div>
        <div className="livree h-2 lg:hidden" />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-8">
          <h1 className="font-display text-3xl font-extrabold">Connexion</h1>

          <div role="tablist" aria-label="Type de compte" className="mt-6 grid grid-cols-2 rounded-xl bg-trait/60 p-1">
            {(['etudiant', 'personnel'] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={espace === v}
                onClick={() => { setEspace(v); setErreur(null); setIdentifiant(''); setMdp(''); }}
                className={cx(
                  'min-h-11 rounded-lg text-base font-semibold transition-colors',
                  espace === v ? 'bg-surface shadow-sm' : 'text-encre-2',
                )}
              >
                {v === 'etudiant' ? 'Étudiant' : 'Contrôleur / Admin'}
              </button>
            ))}
          </div>

          <form onSubmit={soumettre} className="mt-6 space-y-4">
            <Champ
              label={espace === 'etudiant' ? 'Matricule' : 'Identifiant'}
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              autoComplete="username"
              autoCapitalize="characters"
              inputMode="text"
              required
            />
            <div>
              <Champ
                label="Mot de passe"
                type={voir ? 'text' : 'password'}
                value={mdp}
                onChange={(e) => setMdp(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setVoir(!voir)} className="mt-1.5 text-sm font-semibold text-encre-2 underline underline-offset-4">
                {voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              </button>
            </div>

            {erreur && (
              <Message>
                {erreur.message}
                {erreur.code === 'non_active' && (
                  <>
                    {' '}<Link href="/activation" className="underline">Activer mon compte</Link>
                  </>
                )}
              </Message>
            )}

            <Btn type="submit" variante="jaune" grand chargement={envoi} className="w-full">Se connecter</Btn>
          </form>

          {espace === 'etudiant' ? (
            <div className="mt-8 rounded-xl border border-trait bg-surface p-4">
              <p className="font-semibold">Première connexion ?</p>
              <p className="mt-1 text-[15px] text-encre-2">
                Votre matricule doit figurer sur la liste des étudiants ayant payé le car.
              </p>
              <Link href="/activation" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                Activer mon compte
              </Link>
              <p className="mt-2 text-sm text-encre-2">Mot de passe oublié : demandez sa réinitialisation à l’administration.</p>
            </div>
          ) : (
            <p className="mt-8 text-sm text-encre-2">Les comptes contrôleur sont créés par l’administration.</p>
          )}
        </div>
      </section>
    </main>
  );
}
