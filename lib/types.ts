// Types partagés — reflètent les tables Supabase définies dans
// supabase/migrations/0001_init.sql

export type TypeEcriture = 'Dépôt' | 'Retrait' | 'Mouvement interne';

export interface Membre {
  id: string;
  num: number | null;
  nom: string;
  prenom: string | null;
  salutation: string | null;
  email: string | null;
  date_1er_depot: string | null; // ISO date
  auth_user_id: string | null;
  is_admin: boolean;
}

export interface EcritureJournal {
  id: string;
  date: string;                 // date de réception (ISO)
  membre_id: string | null;     // null pour un mouvement interne
  libelle_interne: string | null;
  montant: number;
  type: TypeEcriture;
  moyen: string | null;
  vague: string | null;
  parts: number | null;         // null tant que non souscrit
  date_effective: string | null; // null = en attente de souscription
  frais_impute: number;
}

export interface Valorisation {
  id: string;
  date: string;
  valeur_portefeuille: number;
  evenement_capital: number | null;
  type_evenement: string | null;
}

export interface Parametres {
  parts_initiales: number;
  capital_fondateur: number;
  vl_implicite: number;
  frais_entree: number;
  preavis_jours: number;
  penalite_moins_1an: number;
  penalite_1a_2ans: number;
  penalite_2a_3ans: number;
  penalite_plus_3ans: number;
}

export interface HistoriqueEntry {
  id: string;
  ts: string;
  action: string;
  detail: string;
  actor_id: string | null; // null = action automatique (ex: envoi cron mensuel)
}
