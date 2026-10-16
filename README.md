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

**Règle « à jour » : paliers selon la date** (réglable dans *Paramètres*). Le « Montant » du fichier Excel est le total dû pour l'année ; le total payé (`TOTPAYE`) est comparé au cumul exigé à la date du scan :

| Période | Cumul payé exigé pour être à jour |
|---|---|
| du 1ᵉʳ juillet au 9 décembre | **160 000 FCFA** |
| du 10 décembre au 9 mars | **310 000 FCFA** |
| du 10 mars à fin juin | **460 000 FCFA** (l'étudiant est alors **soldé**) |

- Un car moins cher que 460 000 FCFA par an : l'exigence est **plafonnée au « Montant » du fichier** (ex. montant 300 000 → jamais plus de 300 000 exigés). Option *paliers proportionnels* dans Paramètres (ex. montant 230 000 → 80 000, 155 000, 230 000).
- Les montants et les trois dates sont modifiables dans *Paramètres* (l'année suivante, il suffit de changer les chiffres). Les modes « pourcentage du dû » et « montant fixe » existent aussi.
- La date utilisée est celle **du scan** (un scan fait hors-ligne est jugé à son heure réelle). Les scans, filtres, statistiques et l'espace étudiant appliquent exactement la même règle ; l'étudiant voit le minimum exigé aujourd'hui et le prochain palier.

**Résultat d'un scan**

| Couleur | Titre | Cas |
|---|---|---|
| 🟢 | **Soldé** / **À jour** | Cumul payé ≥ exigence du jour, et bon car (le détail affiche le reste à payer pour l'année) |
| 🟠 | **Pas à jour** | Paiement partiel sous l'exigence du jour (détail : payé, requis, ce qui manque) |
| 🟠 | **À vérifier** | À jour mais étudiant rattaché à un autre car |
| 🔴 | **Pas à jour** | Aucun paiement enregistré |
| 🔴 | Non inscrit / QR invalide / Compte désactivé | À signaler |

Un second scan du même étudiant (même type) dans la minute est enregistré avec un avertissement **doublon**.

**Activation d'un compte** : matricule + vérification (nom tel que sur la liste, **ou** code d'activation). Dans *Paramètres*, vous pouvez rendre le **code obligatoire** (plus sûr) ; les codes sont dans *Rapports › Codes d'activation*. Mot de passe oublié : *Étudiants › fiche › Réinitialiser* génère un nouveau code.

---

## Scan rapide (petits QR codes)

- **Le QR contient le matricule** (réglage par défaut, modifiable dans *Paramètres › Contenu du QR code*). Au scan, l'application **lit le matricule et le compare à la base** : s'il existe, le statut de paiement s'affiche (vert / orange / rouge) ; s'il est **absent de la base**, le résultat est rouge « Non inscrit », avec le matricule lu, et le passage est enregistré (visible dans *Rapports › Non-inscrits*). Un matricule seul donne un QR minuscule et très rapide à lire.
- **Scan de la carte étudiante** : le QR imprimé sur la carte contient le même matricule que la fiche Excel. Le lecteur est tolérant : il retrouve l'étudiant même si le QR contient un lien (`…?mat=IUA241001`), un texte autour (`NOM;IUA241001`) ou un matricule écrit avec tirets/espaces (`IUA24-1001`). La comparaison se fait sur la base (et sur la liste du téléphone hors-ligne) ; l'étudiant n'a même pas besoin d'avoir activé son compte.
- Option **Jeton sécurisé** (`CC1:` + 128 bits aléatoires) : le QR n'est plus devinable. Avec le matricule en clair, quelqu'un qui connaît celui d'un camarade peut fabriquer son QR ; le jeton évite cela. Le scanner accepte toujours les deux formats, et « Régénérer le QR » n'a d'effet que sur le jeton.
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
- QR : au choix de l'admin, le matricule (par défaut, petit et rapide) ou un jeton aléatoire de 128 bits (`CC1:…`, impossible à deviner, régénérable ; l'ancien QR est aussitôt invalide).
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
