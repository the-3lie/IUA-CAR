# Contrôle Car

Application web (PWA, mobile-first, 100 % en français) pour gérer le paiement et l'accès aux cars universitaires.
Un seul projet **Next.js (App Router, TypeScript)** : pages React + routes API (`app/api`), base **Neon (PostgreSQL serverless)**, déploiement sur **Vercel**. Aucun serveur séparé.

| Rôle | Ce qu'il fait |
|---|---|
| **Étudiant** | Active son compte avec son matricule, voit son statut de paiement, son car, son **QR personnel** (utilisable hors-ligne) et l'historique de ses montées/descentes |
| **Contrôleur** | Choisit le car et le type de scan, scanne les QR (caméra), voit le résultat plein écran (vert / orange / rouge), recherche manuelle, annule un scan, travaille **hors-ligne** puis synchronise |
| **Administrateur** | Importe les fiches Excel, gère étudiants et contrôleurs, règle la règle d'accès, tableau de bord, rapports exportables en Excel, journal d'audit |

---

## Déploiement (≈ 10 minutes)

### 1. Créer la base Neon
1. Créez un compte sur <https://neon.tech> puis un projet (choisissez la région la plus proche de votre région Vercel).
2. Dans **Connect**, activez **Connection pooling** et copiez la chaîne de connexion. Elle ressemble à :
   `postgresql://user:motdepasse@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require`
3. Vous n'avez **rien d'autre à faire** côté base : les tables se créent automatiquement au premier lancement.

### 2. Importer le dépôt sur Vercel
1. Poussez ce dossier sur GitHub (`git init && git add . && git commit -m "Contrôle Car" && git push`).
2. Sur <https://vercel.com/new>, importez le dépôt (framework détecté : Next.js).

### 3. Renseigner les variables d'environnement
Dans *Settings › Environment Variables* (modèle : `.env.example`) :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Chaîne « pooled » de Neon (avec `sslmode=require`) |
| `AUTH_SECRET` | Secret de signature des sessions, 32 caractères minimum. Générez-le : `openssl rand -base64 48` |
| `ADMIN_USERNAME` | Identifiant du compte administrateur initial |
| `ADMIN_PASSWORD` | Mot de passe de l'administrateur |

### 4. Déployer
Cliquez sur **Deploy**. Ouvrez l'URL, connectez-vous (onglet *Contrôleur / Admin*) avec `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

> `ADMIN_PASSWORD` fait foi : pour changer le mot de passe admin, modifiez la variable sur Vercel et redéployez.
> Neon met la base en veille quand elle est inactive : la première requête peut prendre 1 à 2 s. La connexion réessaie automatiquement avec une attente progressive au lieu de planter.

### En local
```bash
cp .env.example .env.local   # puis renseignez les 4 variables
npm install
npm run dev                  # http://localhost:3000
npm run build                # vérification de production
npm run exemple              # régénère exemple/etudiants-exemple.xlsx
```

---

## Premiers pas (parcours de test)

1. **Admin › Import Excel** : choisissez `exemple/etudiants-exemple.xlsx` (3 feuilles : CAR 5, CAR 11, CAR 21). L'aperçu montre créés / mis à jour / erreurs / doublons (le fichier d'exemple contient volontairement 1 doublon et 1 ligne sans matricule). Validez.
2. **Admin › Contrôleurs** : créez un contrôleur.
3. **Étudiant** : *Première connexion* avec un matricule de l'exemple (ex. `IUA241001`) et son nom tel qu'écrit dans le fichier (ex. `KOUASSI Jean Marc`), puis choisissez un mot de passe.
4. **Contrôleur** (sur téléphone, en HTTPS) : téléchargez la liste, choisissez le car + Montée, scannez le QR affiché par l'étudiant.
5. **Admin › Rapports** : retrouvez les passages, non-inscrits, paiements incomplets, doublons ; exportez en Excel.

### Format des fiches Excel
Première ligne = en-têtes. Colonnes lues (accents, casse et espaces ignorés) : `Matricule`, `Nom et Prénoms`, `Montant`, `TOTPAYE`, `SOLDE`, `CAR`.
Le car est pris dans la colonne `CAR`, sinon dans le nom de la feuille ou du fichier (« CAR 5 »). Les colonnes `Modalités`, `Tranche…`, `Echéance…` sont affichées à l'étudiant. Les lignes « TOTAL » sont ignorées. Un matricule en double : première ligne conservée, doublon signalé. Réimporter met à jour nom, car et paiements sans toucher aux mots de passe, QR ni activations.

---

## Règles métier

**Statut de paiement** (réglable dans *Paramètres*) : *En règle* si le paiement atteint la règle (pourcentage du montant dû, par défaut 100 %, ou montant minimum) ; *Solde à payer* si un paiement partiel existe ; *Non soldé* si rien n'est payé.

**Résultat d'un scan**

| Couleur | Résultat | Cas |
|---|---|---|
| 🟢 | En règle | Règle respectée et bon car |
| 🟠 | À vérifier | Paiement incomplet (solde affiché) et/ou étudiant rattaché à un autre car |
| 🔴 | Non soldé / Non inscrit / QR invalide / Compte désactivé | À signaler |

Un second scan du même étudiant (même type) dans la minute est enregistré avec un avertissement **doublon**.

**Activation d'un compte** : matricule + vérification (nom tel que sur la liste, **ou** code d'activation). Dans *Paramètres*, vous pouvez rendre le **code obligatoire** (plus sûr) ; les codes sont dans *Rapports › Codes d'activation*. Mot de passe oublié : *Étudiants › fiche › Réinitialiser* génère un nouveau code.

---

## Scan rapide (petits QR codes)

- Le QR contient `CC1:` + un jeton aléatoire de 128 bits en **majuscules** : le QR est très compact (≈ 25×25 modules), donc lisible même petit. Le serveur (ou la liste locale hors-ligne) retrouve le matricule derrière le jeton ; les anciens QR restent valides.
- Le lecteur analyse **toute l'image** en haute résolution, avec le détecteur natif du téléphone (`BarcodeDetector`) ou `jsQR` en repli, mise au point continue, bouton **Lampe** et **zoom 1×/2×/3×** si la caméra les propose.
- Le scan est **continu** : le résultat s'affiche **2 secondes** puis disparaît tout seul (toucher l'écran le ferme avant). Il ne bloque jamais le scan suivant : un autre QR scanné pendant l'affichage remplace aussitôt le résultat. Un même QR revu dans les 3 secondes est ignoré (pas de double lecture accidentelle).
- La décision (vert / orange / rouge) est calculée **instantanément sur le téléphone** avec la liste téléchargée, puis envoyée au serveur en arrière-plan (qui recalcule et enregistre). La liste est rafraîchie toutes les 5 minutes en ligne.

## Mode hors-ligne

- La liste complète des étudiants (matricule, nom, car, paiements, jeton QR) est téléchargée dans **IndexedDB** au démarrage de l'écran contrôleur (et via « Mettre à jour »).
- Sans réseau, le contrôleur scanne : la décision est calculée localement avec la **même fonction** que le serveur, et le scan est mis en file d'attente.
- Dès le retour du réseau (ou toutes les 20 s en ligne), la file est envoyée par lots. Le **serveur recalcule tout** (le téléphone n'est jamais cru sur parole), conserve l'heure réelle du scan et ignore les renvois grâce à un identifiant unique par scan : aucun doublon possible.
- Le QR de l'étudiant reste affiché hors-ligne (données gardées sur l'appareil, effacées à la déconnexion).
- Le service worker (`public/sw.js`) met en cache la coquille de l'app, jamais les réponses de l'API.

## Sécurité

- Mots de passe hachés **bcrypt** ; sessions **JWT** en cookie `httpOnly`, `SameSite=Lax`, `Secure` en production. Durées : étudiant 30 j, contrôleur 24 h, admin 12 h.
- **Chaque route API** vérifie la session, le rôle et que le compte est toujours actif ; un étudiant ne lit que ses propres données (`session.uid`, jamais un identifiant fourni par le client). Le middleware protège aussi les pages. Contrôle d'origine sur les écritures.
- QR = jeton aléatoire de 128 bits (`CC1:…`), **jamais le matricule en clair**, régénérable par l'admin (l'ancien QR est aussitôt invalide).
- **Limitation des tentatives** (connexion, activation, changement de mot de passe) stockée en base : 5 échecs → blocage 15 min, plus un plafond par adresse IP.
- Toutes les entrées sont validées (zod) ; requêtes SQL toujours paramétrées ; journal d'audit des actions sensibles (import, changement de car, réinitialisations, QR, désactivations, annulations, paramètres).
- À savoir : la bibliothèque `xlsx` (SheetJS, version npm 0.18.5) a des avis de sécurité connus sur des fichiers malveillants. Ici, la lecture des fichiers se fait **dans le navigateur de l'administrateur** (seul rôle pouvant importer) et le serveur ne fait qu'écrire des exports.

## Structure

```
app/
  connexion, activation/      pages publiques
  etudiant/                   titre de transport, QR, paiement, historique
  controleur/                 préparation, scan, hors-ligne
  admin/                      tableau de bord, import, étudiants, contrôleurs, rapports, paramètres, journal
  api/                        auth, etudiant, controleur, admin (une route = un fichier)
lib/                          db (Neon + schéma auto), auth, scan, import, règle, hors-ligne (IndexedDB)
public/sw.js, app/manifest.ts PWA
exemple/etudiants-exemple.xlsx
```

## Limites connues
- Les polices (Bricolage Grotesque, Instrument Sans) se chargent depuis Google Fonts ; sans réseau, des polices système prennent le relais.
- La caméra exige **HTTPS** (fourni par Vercel).
- Pour les très gros volumes, la liste hors-ligne contient tous les étudiants (~150 octets chacun, compressés) ; elle est téléchargée une fois par session.
