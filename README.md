# QCM Pharma — Résidanat Alger

Site React pour s'entraîner aux QCM du résidanat en pharmacie :

- **Espace Sara** (`#/sara`) : choix des modules, du nombre de questions et du chronomètre,
  correction + explication après chaque question, résultats par module, « refaire mes erreurs ».
- **Admin** (`#/admin`) : protégé par mot de passe — ajout / modification / suppression des questions,
  **ajout rapide** par copier-coller, réglages (chrono, date de l'examen), sauvegarde JSON.
- Chronomètre total + compte à rebours par question (la solution s'affiche quand le temps est écoulé), pause.
- Raccourcis clavier : `A`–`E` pour cocher, `Entrée` pour valider, `P` pour pause.
- **Deux mots de passe** (jamais écrits dans le code, ils sont rangés dans Cloudflare) :
  `SARA_PASSWORD` pour entrer sur le site, `ADMIN_PASSWORD` pour modifier les questions.
  Le mot de passe est retenu sur l'appareil ; lien « Se déconnecter » en bas de page.

Les questions sont stockées dans **Cloudflare KV** (gratuit), donc ce que l'admin ajoute est visible
immédiatement par Sara sur son téléphone ou son ordinateur.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir http://localhost:5173. En local, pas besoin de mot de passe : les questions sont gardées dans le navigateur.

Pour tester exactement comme sur Cloudflare : `npm run cf:dev` puis http://localhost:8788
(mots de passe de test : `sara-test` pour Sara, `admin-test` pour l'admin).

## Format de l'« Ajout rapide »

```
Module: Pharmacologie
L'amoxicilline appartient à la famille des :
A) Macrolides
*B) Bêta-lactamines
C) Aminosides
> C'est une aminopénicilline.

Quels médicaments sont des IEC ?
A) Énalapril *
B) Losartan
C) Captopril *
> Les IEC finissent en -pril.
```

- une ligne vide entre deux questions ;
- `*` devant ou après une réponse = bonne réponse (plusieurs possibles) ;
- `>` devant l'explication ;
- `Module: …` change le module des questions suivantes.

## Mise en ligne : GitHub puis Cloudflare Pages

### 1. Envoyer le code sur GitHub

Créer un dépôt vide sur https://github.com/new (par ex. `qcm-pharma`), puis dans ce dossier :

```bash
git init
git add .
git commit -m "QCM Pharma résidanat"
git branch -M main
git remote add origin https://github.com/VOTRE-NOM/qcm-pharma.git
git push -u origin main
```

### 2. Créer le stockage KV

Tableau de bord Cloudflare → **Storage & Databases → KV** → **Create** → nom : `qcm-pharma`.

### 3. Créer le site Pages

**Workers & Pages → Create → Pages → Connect to Git** → choisir le dépôt, puis :

| Réglage | Valeur |
| --- | --- |
| Framework preset | React (Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |

Cliquer **Save and Deploy**.

### 4. Brancher le KV et les mots de passe

Dans le projet Pages → **Settings** :

- **Bindings → Add → KV namespace** : nom de variable `QCM_KV`, namespace `qcm-pharma`.
- **Variables and Secrets → Add** (type *Secret*) :
  - `ADMIN_PASSWORD` = le mot de passe admin ;
  - `SARA_PASSWORD` = le mot de passe de Sara (si absent, le site est ouvert à tous en lecture).

Puis **Deployments → … → Retry deployment** (les réglages ne s'appliquent qu'aux nouveaux déploiements).

Le site est en ligne sur `https://qcm-pharma.pages.dev` :
- Sara : `https://qcm-pharma.pages.dev/#/sara`
- Admin : `https://qcm-pharma.pages.dev/#/admin`

Chaque `git push` redéploie automatiquement le site. Les questions, elles, restent dans KV.

> Note : KV peut mettre jusqu'à ~1 minute pour propager une modification dans le monde entier.
> Pensez à cliquer « Télécharger (JSON) » dans l'admin de temps en temps pour garder une copie.
