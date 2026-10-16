'use client';
import { useEffect, useState } from 'react';
import { Btn, Carte, Champ, Chargement, Message, cx } from '@/components/ui';
import { api, ErreurApi } from '@/lib/client';
import { useApi } from '@/lib/useApi';
import { fcfa, type Paliers, type Regle } from '@/lib/shared';

type Params = { regle: Regle; activation: 'nom' | 'code'; qr: 'matricule' | 'jeton' };

const enJJMM = (md: string) => { const [m, d] = md.split('-'); return `${d}/${m}`; };
const enMMJJ = (s: string) => { const m = s.trim().match(/^(\d{1,2})[/.-](\d{1,2})$/); return m ? `${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s; };
const mois = (md: string) => new Date(Date.UTC(2001, Number(md.split('-')[0]) - 1, 1)).toLocaleDateString('fr-FR', { month: 'long' });
const long = (md: string) => `${Number(md.split('-')[1])} ${mois(md)}`;

export default function Parametres() {
  const { data, erreur, chargement } = useApi<Params>('/api/admin/parametres');
  const [mode, setMode] = useState<Regle['mode']>('paliers');
  const [valeur, setValeur] = useState('100');
  const [p, setP] = useState({ p1: '160000', p2: '310000', p3: '460000', b1: '10/12', b2: '10/03', r: '01/07', prop: false });
  const [activation, setActivation] = useState<'nom' | 'code'>('nom');
  const [qr, setQr] = useState<'matricule' | 'jeton'>('matricule');
  const [msg, setMsg] = useState<{ type: 'succes' | 'erreur'; texte: string } | null>(null);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    if (!data) return;
    setMode(data.regle.mode); setValeur(String(data.regle.valeur)); setActivation(data.activation); setQr(data.qr);
    const x = data.regle.paliers;
    setP({ p1: String(x.p1), p2: String(x.p2), p3: String(x.p3), b1: enJJMM(x.bascule1), b2: enJJMM(x.bascule2), r: enJJMM(x.reinit), prop: x.proportionnel });
  }, [data]);

  const nombre = (s: string) => Number(s.replace(/[\s\u00a0]/g, '').replace(',', '.'));

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault(); setOccupe(true); setMsg(null);
    const paliers: Paliers = {
      p1: nombre(p.p1), p2: nombre(p.p2), p3: nombre(p.p3),
      bascule1: enMMJJ(p.b1), bascule2: enMMJJ(p.b2), reinit: enMMJJ(p.r), proportionnel: p.prop,
    };
    try {
      await api('/api/admin/parametres', { method: 'PUT', corps: { mode, valeur: nombre(valeur), activation, qr, paliers } });
      setMsg({ type: 'succes', texte: 'Paramètres enregistrés. Les contrôleurs les récupèrent au prochain téléchargement de la liste (automatique toutes les 5 minutes en ligne).' });
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

  const [p1, p2, p3] = [nombre(p.p1), nombre(p.p2), nombre(p.p3)];
  const [b1, b2, r] = [enMMJJ(p.b1), enMMJJ(p.b2), enMMJJ(p.r)];
  const datesOk = /^\d\d-\d\d$/.test(b1) && /^\d\d-\d\d$/.test(b2) && /^\d\d-\d\d$/.test(r);

  return (
    <form onSubmit={enregistrer} className="max-w-3xl space-y-8">
      <h1 className="font-display text-3xl font-extrabold">Paramètres</h1>

      <Carte className="space-y-5 p-5">
        <div>
          <h2 className="font-display text-lg font-extrabold">Règle « à jour »</h2>
          <p className="text-[15px] text-encre-2">Quand un étudiant est-il à jour (vert au scan) ? Sinon il est « pas à jour » (orange s’il a payé une partie, rouge s’il n’a rien payé).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Choix v="paliers" courant={mode} set={setMode} titre="Paliers selon la date" texte="Le cumul exigé augmente au fil de l’année." />
          <Choix v="pourcentage" courant={mode} set={setMode} titre="Pourcentage du dû" texte="Ex. 100 % = soldé." />
          <Choix v="montant" courant={mode} set={setMode} titre="Montant fixe" texte="Ex. 25 000 FCFA payés minimum." />
        </div>

        {mode === 'paliers' ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Champ label="Palier 1 (FCFA)" inputMode="numeric" value={p.p1} onChange={(e) => setP({ ...p, p1: e.target.value })} />
              <Champ label="Palier 2 (FCFA)" inputMode="numeric" value={p.p2} onChange={(e) => setP({ ...p, p2: e.target.value })} />
              <Champ label="Palier 3 (FCFA)" inputMode="numeric" value={p.p3} onChange={(e) => setP({ ...p, p3: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Champ label="Palier 2 à partir du" placeholder="JJ/MM" value={p.b1} onChange={(e) => setP({ ...p, b1: e.target.value })} />
              <Champ label="Palier 3 à partir du" placeholder="JJ/MM" value={p.b2} onChange={(e) => setP({ ...p, b2: e.target.value })} />
              <Champ label="Retour au palier 1 le" placeholder="JJ/MM" value={p.r} onChange={(e) => setP({ ...p, r: e.target.value })} aide="Nouvelle année scolaire." />
            </div>
            {datesOk && (
              <div className="rounded-xl border border-trait bg-fond p-4 text-[15px]">
                <p className="font-semibold">Ce que l’application appliquera :</p>
                <ul className="mt-1.5 space-y-1">
                  <li>Du {long(r)} au {long(b1)} (veille) : à jour si au moins <strong>{fcfa(p1)}</strong> payés.</li>
                  <li>Du {long(b1)} au {long(b2)} (veille) : à jour si au moins <strong>{fcfa(p2)}</strong>.</li>
                  <li>Du {long(b2)} au {long(r)} (veille) : à jour si au moins <strong>{fcfa(p3)}</strong> ; à ce niveau l’étudiant est <strong>soldé</strong>.</li>
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <p className="font-semibold">Cars moins chers que {fcfa(p3)} par an</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Choix v="plafond" courant={p.prop ? 'prop' : 'plafond'} set={() => setP({ ...p, prop: false })} titre="Plafonner au montant du fichier" texte="Exigé = le plus petit entre le palier et le « Montant » de l’étudiant. Ex. montant 300 000 : jamais plus de 300 000 exigés." />
                <Choix v="prop" courant={p.prop ? 'prop' : 'plafond'} set={() => setP({ ...p, prop: true })} titre="Paliers proportionnels" texte="Les paliers 1 et 2 sont réduits dans la même proportion que le montant. Ex. montant 230 000 : 80 000, puis 155 000, puis 230 000." />
              </div>
            </div>
          </div>
        ) : (
          <Champ label={mode === 'pourcentage' ? 'Pourcentage minimum (0 à 100)' : 'Montant minimum (FCFA)'} inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} className="max-w-xs" required />
        )}
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
