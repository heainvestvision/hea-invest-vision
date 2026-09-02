-- HEA Invest Vision — schéma initial
-- Traduit le modèle de données du prototype (membres / journal / valorisations /
-- parametres / historique) en tables Postgres, avec liaison à Supabase Auth et
-- des politiques RLS (Row Level Security) qui appliquent réellement la séparation
-- admin / membre (le prototype ne faisait que la simuler visuellement).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- MEMBRES
-- ---------------------------------------------------------------------------
create table membres (
  id             uuid primary key default gen_random_uuid(),
  num            integer,                          -- ordre d'affichage (reprend la numérotation du fichier Excel)
  nom            text not null unique,              -- nom complet en majuscules — clé métier reprise du prototype
  prenom         text,
  salutation     text,                              -- prénom utilisé dans les emails ("Cher(e) Flora,")
  email          text unique,
  date_1er_depot date,
  auth_user_id   uuid unique references auth.users(id) on delete set null,
  is_admin       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Vue publique (sans email) pour que n'importe quel membre connecté puisse voir
-- la liste et les noms des autres membres (nécessaire pour le classement / cap table)
-- sans pouvoir récupérer leurs adresses email.
create view membres_public as
  select id, num, nom, prenom from membres;

-- ---------------------------------------------------------------------------
-- JOURNAL (dépôts, retraits, mouvements internes)
-- ---------------------------------------------------------------------------
create table journal (
  id              uuid primary key default gen_random_uuid(),
  date            date not null,                    -- date de réception
  membre_id       uuid references membres(id) on delete restrict,  -- null pour un mouvement interne
  libelle_interne text,                              -- libellé quand membre_id est null (ex: "Transfert vers compte-titres")
  montant         numeric not null,
  type            text not null check (type in ('Dépôt','Retrait','Mouvement interne')),
  moyen           text,
  vague           text,                              -- 'Fondateur' | 'Post-fondation' | '-'
  parts           numeric,                           -- parts attribuées ; null tant que non souscrit (dépôt en attente)
  date_effective  date,                               -- date de souscription (VL appliquée) ; null = en attente
  frais_impute    numeric not null default 0,
  created_at      timestamptz not null default now(),
  constraint journal_membre_or_interne check (
    (type = 'Mouvement interne' and membre_id is null and libelle_interne is not null)
    or (type in ('Dépôt','Retrait') and membre_id is not null)
  )
);
create index journal_membre_id_idx on journal(membre_id);
create index journal_date_effective_idx on journal(date_effective);

-- ---------------------------------------------------------------------------
-- VALORISATIONS (relevé hebdomadaire de la valeur du portefeuille)
-- ---------------------------------------------------------------------------
create table valorisations (
  id                  uuid primary key default gen_random_uuid(),
  date                date not null unique,
  valeur_portefeuille numeric not null,
  evenement_capital   numeric,
  type_evenement      text,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PARAMETRES (ligne unique — les constantes du club)
-- ---------------------------------------------------------------------------
create table parametres (
  id                  integer primary key default 1 check (id = 1),
  parts_initiales     numeric not null,
  capital_fondateur   numeric not null,
  vl_implicite        numeric not null,
  frais_entree        numeric not null default 0,
  preavis_jours       integer not null default 30,
  penalite_moins_1an  numeric not null default 0.03,
  penalite_1a_2ans    numeric not null default 0.02,
  penalite_2a_3ans    numeric not null default 0.01,
  penalite_plus_3ans  numeric not null default 0
);

-- ---------------------------------------------------------------------------
-- HISTORIQUE (journal d'audit des modifications faites par l'admin)
-- ---------------------------------------------------------------------------
create table historique (
  id       uuid primary key default gen_random_uuid(),
  ts       timestamptz not null default now(),
  action   text not null,   -- 'Ajout' | 'Modification' | 'Suppression' | 'Souscription'
  detail   text not null,
  actor_id uuid references auth.users(id)
);

-- ---------------------------------------------------------------------------
-- Fonction utilitaire : l'utilisateur courant est-il admin ?
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce((select is_admin from membres where auth_user_id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table membres        enable row level security;
alter table journal        enable row level security;
alter table valorisations  enable row level security;
alter table parametres     enable row level security;
alter table historique     enable row level security;

-- membres : l'admin voit tout (avec email) ; un membre ne voit que sa propre ligne complète.
-- (la liste des autres membres, sans email, passe par la vue membres_public, lisible par tous les connectés)
create policy membres_select_admin on membres for select
  using (is_admin());
create policy membres_select_self on membres for select
  using (auth_user_id = auth.uid());
create policy membres_write_admin on membres for all
  using (is_admin()) with check (is_admin());

-- journal / valorisations / parametres : lecture ouverte à tout utilisateur connecté
-- (nécessaire pour calculer dashboard / cap table), écriture réservée à l'admin.
create policy journal_select_auth on journal for select
  using (auth.role() = 'authenticated');
create policy journal_write_admin on journal for all
  using (is_admin()) with check (is_admin());

create policy valorisations_select_auth on valorisations for select
  using (auth.role() = 'authenticated');
create policy valorisations_write_admin on valorisations for all
  using (is_admin()) with check (is_admin());

create policy parametres_select_auth on parametres for select
  using (auth.role() = 'authenticated');
create policy parametres_write_admin on parametres for all
  using (is_admin()) with check (is_admin());

-- historique : réservé à l'admin (lecture et écriture)
create policy historique_all_admin on historique for all
  using (is_admin()) with check (is_admin());
