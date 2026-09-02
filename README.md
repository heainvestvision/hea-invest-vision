# HEA Invest Vision — application déployée

Ce dossier contient l'application web complète de HEA Invest Vision : authentification
réelle par membre, base de données Postgres (Supabase), et envoi automatique par email
des rapports individuels et avis de souscription (PDF joint automatiquement — plus
besoin de le joindre à la main).

Elle reprend fidèlement la logique de calcul du prototype (parts / VL / cap table),
vérifiée pour reproduire exactement les mêmes chiffres, et toutes les données
actuelles du club (22 membres, 68 écritures de journal, valorisations, historique).

Tout est en offre gratuite pour démarrer : Supabase (gratuit), Vercel (gratuit),
adresse en `xxx.vercel.app` (un nom de domaine personnalisé pourra être branché plus
tard sans rien reconstruire).

## Ce dont tu as besoin avant de commencer

- Un compte [Supabase](https://supabase.com) (gratuit, connexion avec Google ou email)
- Un compte [Vercel](https://vercel.com) (gratuit, connexion avec GitHub recommandée)
- Un compte GitHub (pour héberger le code source — nécessaire pour connecter Vercel)
- Une adresse Gmail dédiée au club (à créer si elle n'existe pas encore), pour l'envoi
  automatique des emails

---

## Étape 1 — Créer le projet Supabase (base de données + authentification)

1. Va sur [supabase.com](https://supabase.com) → **New project**.
2. Choisis un nom (ex. `hea-invest-vision`), un mot de passe de base de données (à
   conserver de côté, tu n'en auras normalement plus besoin après), et une région
   proche (Europe de l'Ouest par exemple).
3. Une fois le projet créé (1-2 minutes), va dans **Project Settings → API**. Note
   quelque part (temporairement) :
   - `Project URL` → deviendra `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → deviendra `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (bouton "Reveal") → deviendra `SUPABASE_SERVICE_ROLE_KEY`
     **Cette clé est un secret absolu : elle donne un accès total à la base, sans
     restriction. Ne la partage jamais, ne la mets jamais dans un message ou un
     fichier commité sur GitHub.**

## Étape 2 — Créer les tables et importer les données actuelles

1. Dans Supabase, ouvre **SQL Editor** (menu de gauche) → **New query**.
2. Ouvre le fichier `supabase/migrations/0001_init.sql` de ce dossier, copie tout son
   contenu, colle-le dans l'éditeur SQL, et clique **Run**. Cela crée les tables
   (membres, journal, valorisations, paramètres, historique) et les règles de
   sécurité (RLS) qui distinguent réellement admin et membre.
3. Fais la même chose avec `supabase/migrations/0002_seed_data.sql` : nouvelle
   requête, coller, **Run**. Cela importe les 22 membres, les 68 écritures de
   journal, les valorisations et l'historique actuels — l'app démarre donc avec
   toutes les données réelles du club déjà en place, pas une base vide.
4. Vérifie rapidement : **Table Editor → membres** doit afficher 22 lignes, et
   **journal** doit en afficher 68.

## Étape 3 — Vérifier l'authentification par email (lien magique)

Par défaut, Supabase active déjà l'authentification par email avec lien magique
(pas de mot de passe à gérer) — c'est ce que l'app utilise. Rien à faire en principe.
Si tu veux personnaliser le texte de l'email de connexion envoyé par Supabase :
**Authentication → Email Templates → Magic Link**.

## Étape 4 — Créer l'adresse Gmail du club et son mot de passe d'application

L'envoi automatique des rapports/avis avec PDF joint passe par un vrai compte Gmail.

1. Crée (ou utilise) une adresse Gmail dédiée au club, par exemple
   `club.hea.invest@gmail.com`.
2. Active la validation en 2 étapes sur ce compte : **Compte Google → Sécurité →
   Validation en 2 étapes** (obligatoire pour générer un mot de passe d'application).
3. Toujours dans **Sécurité**, cherche **Mots de passe des applications** (ou va
   directement sur [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
   Crée un mot de passe d'application (nom libre, ex. "HEA Invest Vision"). Google
   affiche un code à 16 caractères — **copie-le immédiatement**, il ne sera plus
   jamais réaffiché.
4. Garde cette adresse email et ce mot de passe de côté pour l'étape 6 (variables
   d'environnement Vercel). Ce mot de passe n'est PAS le mot de passe habituel du
   compte Gmail — c'est un code séparé, réservé à cet usage, révocable à tout moment
   sans toucher au compte.

## Étape 5 — Mettre le code sur GitHub

1. Crée un nouveau repository GitHub (privé de préférence), par exemple
   `hea-invest-vision`.
2. Depuis le dossier `app/` de cette livraison, initialise et pousse le code :

   ```bash
   cd app
   git init
   git add .
   git commit -m "HEA Invest Vision — version initiale"
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/hea-invest-vision.git
   git push -u origin main
   ```

   (`node_modules` et `.next` sont déjà exclus via `.gitignore`.)

## Étape 6 — Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com) → **Add New → Project** → importe le
   repository GitHub créé à l'étape 5.
2. Vercel détecte automatiquement Next.js — laisse les réglages par défaut.
3. Avant de cliquer sur **Deploy**, ouvre **Environment Variables** et ajoute les 5
   variables suivantes (valeurs récupérées aux étapes 1 et 4) :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé `anon public` de Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé `service_role` de Supabase |
   | `GMAIL_USER` | l'adresse Gmail du club |
   | `GMAIL_APP_PASSWORD` | le mot de passe d'application à 16 caractères |

4. Clique **Deploy**. Après 1-2 minutes, Vercel donne une adresse du type
   `hea-invest-vision.vercel.app` — c'est l'adresse définitive de l'app pour
   l'instant (un nom de domaine personnalisé pourra être ajouté plus tard dans
   **Project Settings → Domains**, sans rien reconstruire).

## Étape 7 — Première connexion et rattachement du compte admin

1. Va sur l'adresse Vercel, connecte-toi avec l'adresse email qui est enregistrée
   comme admin dans la base (ODEDELE RILWANE ADEKUNLE). Un lien de connexion est
   envoyé par email — clique dessus.
2. Ce premier clic rattache automatiquement le compte à la fiche membre
   correspondante (par correspondance d'email) — aucune manipulation manuelle
   requise. Tu arrives directement sur le tableau de bord avec les droits admin.
3. Chaque membre suit ensuite la même logique : il se connecte une fois avec
   l'adresse email exacte que l'admin a renseignée pour lui dans l'onglet
   **Membres**, et son compte se rattache automatiquement. Si l'adresse email
   change, l'admin doit la mettre à jour dans l'onglet Membres AVANT que le membre
   ne se reconnecte.

## Ce que ça change par rapport au prototype

- Chaque membre a désormais un vrai compte, protégé, qui ne voit que ce qu'il a le
  droit de voir (la séparation admin / membre est appliquée par la base de données
  elle-même, pas seulement par l'interface).
- Le rapport individuel et l'avis de souscription s'envoient par email en un clic,
  PDF déjà joint automatiquement — le serveur génère le PDF et l'attache lui-même à
  un vrai envoi SMTP. C'est la vraie solution au problème du "je dois joindre le PDF
  moi-même" rencontré dans le prototype (un lien `mailto:` dans un navigateur ne
  peut techniquement joindre aucun fichier, quel que soit le navigateur — c'est un
  envoi serveur qui permet de le faire).

## Limites connues de cette première version (à savoir, pas bloquant)

- Le nom de domaine est celui fourni gratuitement par Vercel (`xxx.vercel.app`) ; un
  domaine personnalisé (ex. `hea-invest.com`) peut être ajouté plus tard.
- Les offres gratuites Supabase et Vercel suffisent largement pour 22 membres, mais
  Supabase met en pause un projet gratuit après 7 jours d'inactivité totale (il
  suffit d'ouvrir l'app pour le réactiver, avec quelques secondes de délai au premier
  chargement).
- Le PDF est régénéré à chaque envoi (pas d'archive de PDF déjà envoyés) — si utile,
  cette historisation pourra être ajoutée dans une prochaine évolution.
