'use client';
import { useState } from 'react';
import { Btn, Carte, Champ, Chargement, Message, Vide } from '@/components/ui';
import { api, ErreurApi } from '@/lib/client';
import { useApi } from '@/lib/useApi';

type Ctl = { id: number; identifiant: string; nom: string; actif: boolean; scans_jour: number };

export default function Controleurs() {
  const { data, erreur, chargement, recharger } = useApi<{ controleurs: Ctl[] }>('/api/admin/controleurs');
  const [nom, setNom] = useState('');
  const [identifiant, setIdentifiant] = useState('');
  const [mdp, setMdp] = useState('');
  const [msg, setMsg] = useState<{ type: 'succes' | 'erreur' | 'attention'; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function creer(e: React.FormEvent) {
    e.preventDefault(); setOccupe(true); setMsg(null);
    try {
      const r = await api<{ identifiant: string; mot_de_passe: string }>('/api/admin/controleurs', { corps: { nom, identifiant, mot_de_passe: mdp || undefined } });
      setMsg({ type: 'succes', texte: `Compte créé. Identifiant : ${r.identifiant} · mot de passe : ${r.mot_de_passe}. Notez-le : il ne sera plus affiché.` });
      setNom(''); setIdentifiant(''); setMdp(''); recharger();
    } catch (err) { setMsg({ type: 'erreur', texte: (err as ErreurApi).message }); }
    setOccupe(false);
  }

  async function modifier(c: Ctl, corps: object, ok: (r: any) => string) {
    setMsg(null);
    try { const r = await api<any>(`/api/admin/controleurs/${c.id}`, { method: 'PATCH', corps }); setMsg({ type: 'succes', texte: ok(r) }); recharger(); }
    catch (err) { setMsg({ type: 'erreur', texte: (err as ErreurApi).message }); }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold">Contrôleurs</h1>
      {msg && <Message type={msg.type}>{msg.texte}</Message>}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Carte>
          {chargement && !data ? <Chargement /> : erreur ? <div className="p-4"><Message>{erreur}</Message></div> : data!.controleurs.length === 0 ? <Vide>Aucun contrôleur. Créez le premier avec le formulaire.</Vide> : (
            <ul className="divide-y divide-trait">
              {data!.controleurs.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{c.nom} {!c.actif && <span className="ml-1 rounded-full bg-danger px-2 py-0.5 text-xs text-white">Désactivé</span>}</p>
                    <p className="nombres text-sm text-encre-2">{c.identifiant} · {c.scans_jour} scan{c.scans_jour > 1 ? 's' : ''} aujourd’hui</p>
                  </div>
                  <Btn variante="contour" onClick={() => modifier(c, { reinitialiser_mot_de_passe: true }, (r) => `Nouveau mot de passe de ${c.identifiant} : ${r.mot_de_passe}`)}>Réinitialiser le mot de passe</Btn>
                  <Btn variante={c.actif ? 'discret' : 'primaire'} onClick={() => modifier(c, { actif: !c.actif }, () => (c.actif ? 'Compte désactivé.' : 'Compte réactivé.'))}>{c.actif ? 'Désactiver' : 'Réactiver'}</Btn>
                </li>
              ))}
            </ul>
          )}
        </Carte>

        <Carte className="h-fit p-5">
          <h2 className="font-display text-lg font-extrabold">Nouveau contrôleur</h2>
          <form onSubmit={creer} className="mt-4 space-y-4">
            <Champ label="Nom complet" value={nom} onChange={(e) => setNom(e.target.value)} required />
            <Champ label="Identifiant" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoCapitalize="none" aide="3 à 30 caractères, sans espace." required />
            <Champ label="Mot de passe" type="text" value={mdp} onChange={(e) => setMdp(e.target.value)} aide="Laissez vide pour en générer un." autoComplete="off" />
            <Btn type="submit" chargement={occupe} className="w-full">Créer le compte</Btn>
          </form>
        </Carte>
      </div>
    </div>
  );
}
