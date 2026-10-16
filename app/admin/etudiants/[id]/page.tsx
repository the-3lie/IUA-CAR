'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { Btn, Carte, Chargement, Champ, Message, PastilleStatut } from '@/components/ui';
import { api, ErreurApi } from '@/lib/client';
import { useApi } from '@/lib/useApi';
import { fcfa, formatDateHeure, RESULTAT_LABEL, TYPE_LABEL, type Resultat, type Statut } from '@/lib/shared';

type Fiche = {
  id: number; matricule: string; nom: string; car: string | null; actif: boolean; active: boolean; date_activation: string | null;
  code_activation: string | null; montant_du: number; total_paye: number; solde: number; modalites: string | null;
  statut: Statut; qr: string;
  passages: { id: string; horodatage: string; type: 'montee' | 'descente'; resultat: Resultat; detail: string | null; doublon: boolean; annule: boolean; car: string | null; controleur: string | null }[];
};

export default function FicheEtudiant() {
  const { id } = useParams<{ id: string }>();
  const { data: f, erreur, chargement, recharger } = useApi<Fiche>(`/api/admin/etudiants/${id}`);
  const { data: cars } = useApi<{ cars: { id: number; nom: string }[] }>('/api/admin/cars');
  const [car, setCar] = useState('');
  const [msg, setMsg] = useState<{ type: 'succes' | 'erreur' | 'attention'; texte: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  useEffect(() => { if (f) setCar(f.car ?? ''); }, [f]);

  async function agir(fn: () => Promise<string | void>) {
    setOccupe(true); setMsg(null); setConfirm(null);
    try { const t = await fn(); if (t) setMsg({ type: 'succes', texte: t }); await recharger(); }
    catch (e) { setMsg({ type: 'erreur', texte: (e as ErreurApi).message }); }
    setOccupe(false);
  }

  if (chargement && !f) return <Chargement />;
  if (erreur || !f) return <Message>{erreur ?? 'Étudiant introuvable.'}</Message>;

  return (
    <div className="space-y-6">
      <Link href="/admin/etudiants" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Retour à la liste</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-extrabold">{f.nom}</h1>
        <PastilleStatut statut={f.statut} />
        {!f.actif && <span className="rounded-full bg-danger px-3 py-1 text-sm font-bold text-white">Désactivé</span>}
      </div>
      <p className="nombres -mt-4 text-encre-2">Matricule {f.matricule}</p>

      {msg && <Message type={msg.type}>{msg.texte}</Message>}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Carte className="p-5">
            <h2 className="font-display text-lg font-extrabold">Paiement</h2>
            <dl className="mt-3 grid grid-cols-3 gap-4">
              {[['Dû', f.montant_du], ['Payé', f.total_paye], ['Solde', f.solde]].map(([k, v]) => (
                <div key={k as string}><dt className="text-sm text-encre-2">{k}</dt><dd className="nombres text-lg font-extrabold">{fcfa(v as number)}</dd></div>
              ))}
            </dl>
            {f.modalites && <p className="mt-4 whitespace-pre-line border-t border-trait pt-3 text-[15px] text-encre-2">{f.modalites}</p>}
          </Carte>

          <Carte className="p-5">
            <h2 className="font-display text-lg font-extrabold">Car attribué</h2>
            <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); agir(async () => { await api(`/api/admin/etudiants/${id}`, { method: 'PATCH', corps: { car: car.trim() || null } }); return 'Car mis à jour.'; }); }}>
              <div className="min-w-48 flex-1">
                <Champ label="Car" list="liste-cars" value={car} onChange={(e) => setCar(e.target.value)} aide="Choisissez un car existant ou saisissez un nouveau nom." />
                <datalist id="liste-cars">{cars?.cars.map((c) => <option key={c.id} value={c.nom} />)}</datalist>
              </div>
              <Btn type="submit" chargement={occupe} disabled={(car.trim().toUpperCase() === (f.car ?? ''))}>Enregistrer</Btn>
            </form>
          </Carte>

          <Carte>
            <h2 className="px-5 pt-5 font-display text-lg font-extrabold">Derniers passages</h2>
            {f.passages.length === 0 ? <p className="px-5 py-6 text-encre-2">Aucun passage enregistré.</p> : (
              <div className="overflow-x-auto"><table className="mt-3 w-full min-w-[560px] text-left text-sm">
                <thead className="border-y border-trait bg-fond text-encre-2"><tr><th className="px-5 py-2">Date et heure</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Car</th><th className="px-3 py-2">Résultat</th><th className="px-5 py-2">Contrôleur</th></tr></thead>
                <tbody className="divide-y divide-trait">
                  {f.passages.map((p) => (
                    <tr key={p.id} className={p.annule ? 'text-encre-2 line-through' : ''}>
                      <td className="nombres px-5 py-2">{formatDateHeure(p.horodatage)}</td><td className="px-3 py-2">{TYPE_LABEL[p.type]}</td><td className="px-3 py-2">{p.car ?? '—'}</td>
                      <td className="px-3 py-2">{RESULTAT_LABEL[p.resultat]}{p.doublon ? ' (doublon)' : ''}{p.annule ? ' (annulé)' : ''}</td><td className="px-5 py-2">{p.controleur ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Carte>
        </div>

        <div className="space-y-6">
          <Carte className="p-5">
            <h2 className="font-display text-lg font-extrabold">Compte</h2>
            <p className="mt-2 text-[15px] text-encre-2">
              {f.active ? `Activé le ${formatDateHeure(f.date_activation!)}.` : 'Pas encore activé par l’étudiant.'}
            </p>
            {f.code_activation && (
              <p className="mt-3 rounded-xl bg-car/30 px-4 py-3">Code d’activation : <strong className="nombres text-xl tracking-widest">{f.code_activation}</strong></p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              <Action id="mdp" actif={confirm} set={setConfirm} libelle="Réinitialiser le mot de passe" question="Il devra réactiver son compte avec un nouveau code. Confirmer ?" occupe={occupe}
                onConfirm={() => agir(async () => { const r = await api<{ code_activation: string }>(`/api/admin/etudiants/${id}/action`, { corps: { action: 'reinitialiser_mot_de_passe' } }); return `Mot de passe réinitialisé. Nouveau code d’activation : ${r.code_activation}`; })} />
              <Action id="qr" actif={confirm} set={setConfirm} libelle="Régénérer le QR code" question="L’ancien QR code ne fonctionnera plus. Confirmer ?" occupe={occupe}
                onConfirm={() => agir(async () => { await api(`/api/admin/etudiants/${id}/action`, { corps: { action: 'regenerer_qr' } }); return 'Nouveau QR code généré. L’ancien est invalide.'; })} />
              <Action id="actif" actif={confirm} set={setConfirm} libelle={f.actif ? 'Désactiver le compte' : 'Réactiver le compte'} danger={f.actif}
                question={f.actif ? 'L’étudiant sera refusé au scan (rouge). Confirmer ?' : 'Réactiver ce compte ?'} occupe={occupe}
                onConfirm={() => agir(async () => { await api(`/api/admin/etudiants/${id}`, { method: 'PATCH', corps: { actif: !f.actif } }); return f.actif ? 'Compte désactivé.' : 'Compte réactivé.'; })} />
            </div>
          </Carte>
          <Carte className="p-5">
            <h2 className="font-display text-lg font-extrabold">QR code actuel</h2>
            <div className="mt-3 w-48 rounded-xl border border-trait bg-white p-2"><QRCodeSVG value={f.qr} size={256} level="M" style={{ width: '100%', height: 'auto' }} /></div>
          </Carte>
        </div>
      </div>
    </div>
  );
}

function Action({ id, actif, set, libelle, question, onConfirm, occupe, danger }: {
  id: string; actif: string | null; set: (v: string | null) => void; libelle: string; question: string; onConfirm: () => void; occupe: boolean; danger?: boolean;
}) {
  if (actif !== id) return <Btn variante="contour" onClick={() => set(id)} disabled={occupe}>{libelle}</Btn>;
  return (
    <div className="rounded-xl border-2 border-encre p-3">
      <p className="text-[15px] font-medium">{question}</p>
      <div className="mt-2 flex gap-2">
        <Btn variante={danger ? 'danger' : 'primaire'} onClick={onConfirm} chargement={occupe}>Confirmer</Btn>
        <Btn variante="discret" onClick={() => set(null)}>Annuler</Btn>
      </div>
    </div>
  );
}
