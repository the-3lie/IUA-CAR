'use client';
import { useEffect, useState } from 'react';
import { Btn, Carte, Champ, Chargement, Message, cx } from '@/components/ui';
import { api, ErreurApi } from '@/lib/client';
import { useApi } from '@/lib/useApi';
import type { Regle } from '@/lib/shared';

type Params = { regle: Regle; activation: 'nom' | 'code'; qr: 'matricule' | 'jeton' };

export default function Parametres() {
  const { data, erreur, chargement } = useApi<Params>('/api/admin/parametres');
  const [mode, setMode] = useState<Regle['mode']>('pourcentage');
  const [valeur, setValeur] = useState('100');
  const [activation, setActivation] = useState<'nom' | 'code'>('nom');
  const [qr, setQr] = useState<'matricule' | 'jeton'>('matricule');
  const [msg, setMsg] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => { if (data) { setMode(data.regle.mode); setValeur(String(data.regle.valeur)); setActivation(data.activation); setQr(data.qr); } }, [data]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); setOccupe(true); setMsg(null);
    try {
      await api('/api/admin/parametres', { method: 'PUT', corps: { mode, valeur: Number(valeur.replace(/\s/g, '').replace(',', '.')), activation, qr } });
      setMsg({ type: 'succes', texte: 'Paramètres enregistrés. Les contrôleurs les récupèrent au prochain téléchargement de la liste.' });
    } catch (err) { setMsg({ type: 'erreur', texte: (err as ErreurApi).message }); }
    setOccupe(false);
  }

  if (chargement && !data) return <Chargement />;
  if (erreur) return <Message>{erreur}</Message>;

  const Choix = ({ v, courant, set, titre, texte }: { v: string; courant: string; set: (v: any) => void; titre: string; texte: string }) => (
    <button type="button" onClick={() => set(v)} aria-pressed={courant === v}
      className={cx('rounded-xl border-2 p-4 text-left', courant === v ? 'border-encre bg-car/25' : 'border-trait bg-surface')}>
      <span className="block font-bold">{titre}</span><span className="text-sm text-encre-2">{texte}</span>
    </button>
  );

  return (
    <form onSubmit={enregistrer} className="max-w-2xl space-y-8">
      <h1 className="font-display text-3xl font-extrabold">Paramètres</h1>

      <Carte className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-extrabold">Règle d’accès</h2>
          <p className="text-[15px] text-encre-2">À partir de quel paiement un étudiant est-il « en règle » (vert au scan) ? En dessous, il est « à vérifier » (orange).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choix v="pourcentage" courant={mode} set={setMode} titre="Pourcentage du montant dû" texte="Ex. 100 % = soldé, 50 % = moitié payée." />
          <Choix v="montant" courant={mode} set={setMode} titre="Montant minimum payé" texte="Ex. 25 000 FCFA payés, quel que soit le montant dû." />
        </div>
        <Champ label={mode === 'pourcentage' ? 'Pourcentage minimum (0 à 100)' : 'Montant minimum (FCFA)'} inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} className="max-w-xs" required />
      </Carte>

      <Carte className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-extrabold">Contenu du QR code des étudiants</h2>
          <p className="text-[15px] text-encre-2">Le scanner lit toujours les deux formats. Un matricule lu qui n’existe pas dans la base est enregistré « Non inscrit ».</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choix v="matricule" courant={qr} set={setQr} titre="Le matricule" texte="Le scan lit le matricule et le compare à la base. QR le plus petit et le plus rapide à lire." />
          <Choix v="jeton" courant={qr} set={setQr} titre="Jeton sécurisé" texte="Code aléatoire lié à l’étudiant : impossible à deviner ou à copier depuis le matricule d’un camarade." />
        </div>
        {qr === 'matricule' && <Message type="attention">Avec le matricule, quelqu’un qui connaît le matricule d’un camarade peut fabriquer son QR. Le jeton sécurisé évite cela.</Message>}
      </Carte>

      <Carte className="space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-extrabold">Première connexion des étudiants</h2>
          <p className="text-[15px] text-encre-2">Comment vérifier qu’un étudiant active bien son propre compte.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Choix v="nom" courant={activation} set={setActivation} titre="Nom ou code" texte="Le nom tel qu’il figure sur la liste suffit, le code aussi." />
          <Choix v="code" courant={activation} set={setActivation} titre="Code obligatoire" texte="Plus sûr. Les codes sont dans Rapports › Codes d’activation." />
        </div>
      </Carte>

      {msg && <Message type={msg.type}>{msg.texte}</Message>}
      <Btn type="submit" variante="jaune" grand chargement={occupe}>Enregistrer</Btn>
    </form>
  );
}
