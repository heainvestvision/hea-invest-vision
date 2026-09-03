import { createClient, createAdminClient } from '@/lib/supabase/server';
import { computeEngine, type EngineResult } from '@/lib/engine';
import type { EcritureJournal, Membre, Parametres, Valorisation } from '@/lib/types';

export * from '@/lib/format';

// PostgREST (l'API de Supabase) renvoie les colonnes Postgres de type `numeric` comme
// des CHAÎNES de caractères dans le JSON (ex: "326642.85714285745"), pas comme des
// nombres — c'est volontaire de leur part pour ne pas perdre de précision, mais ça veut
// dire que toutes les colonnes numériques du schéma (montant, parts, frais_impute,
// valeur_portefeuille, evenement_capital, les paramètres...) arrivent ici en string même
// si les types TypeScript dans lib/types.ts déclarent `number`. Sans cette conversion,
// l'affichage brut montre la valeur non arrondie telle quelle (ex: "326642.85714285745"
// au lieu de "326 643 FCFA"), et pire : additionner deux de ces "nombres" avec `+` fait
// une concaténation de texte ("25000" + "5000" = "250005000") au lieu d'une addition —
// ce qui fausse les totaux (solde de caisse, cap table d'un membre ayant fait un retrait,
// etc.). On convertit donc systématiquement en Number() dès la sortie de Supabase, une
// bonne fois pour toutes, pour que tout le reste de l'app manipule de vrais nombres.
function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}
function toNumOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

function normalizeJournal(rows: Record<string, unknown>[]): EcritureJournal[] {
  return rows.map((r) => ({
    ...r,
    montant: toNum(r.montant),
    parts: toNumOrNull(r.parts),
    frais_impute: toNum(r.frais_impute),
  })) as unknown as EcritureJournal[];
}

function normalizeValorisations(rows: Record<string, unknown>[]): Valorisation[] {
  return rows.map((r) => ({
    ...r,
    valeur_portefeuille: toNum(r.valeur_portefeuille),
    evenement_capital: toNumOrNull(r.evenement_capital),
  })) as unknown as Valorisation[];
}

function normalizeParametres(row: Record<string, unknown>): Parametres {
  return {
    ...row,
    parts_initiales: toNum(row.parts_initiales),
    capital_fondateur: toNum(row.capital_fondateur),
    vl_implicite: toNum(row.vl_implicite),
    frais_entree: toNum(row.frais_entree),
    preavis_jours: toNum(row.preavis_jours),
    penalite_moins_1an: toNum(row.penalite_moins_1an),
    penalite_1a_2ans: toNum(row.penalite_1a_2ans),
    penalite_2a_3ans: toNum(row.penalite_2a_3ans),
    penalite_plus_3ans: toNum(row.penalite_plus_3ans),
  } as unknown as Parametres;
}

// Charge toutes les données nécessaires au moteur de calcul et fait tourner
// computeEngine(). Utilisable depuis n'importe quel Server Component / route —
// la RLS s'applique automatiquement selon qui est connecté (voir 0001_init.sql).
export async function loadEngine(): Promise<{
  engine: EngineResult;
  membres: Membre[];
  parametres: Parametres;
}> {
  const supabase = await createClient();

  const [{ data: journal, error: eJournal }, { data: valorisations, error: eValor }, { data: parametresRows, error: eParam }, { data: membres, error: eMembres }] =
    await Promise.all([
      supabase.from('journal').select('*'),
      supabase.from('valorisations').select('*'),
      supabase.from('parametres').select('*').eq('id', 1).single(),
      supabase.from('membres_public').select('*'),
    ]);

  if (eJournal) throw eJournal;
  if (eValor) throw eValor;
  if (eParam) throw eParam;
  if (eMembres) throw eMembres;

  const parametres = normalizeParametres(parametresRows as Record<string, unknown>);
  const journalNorm = normalizeJournal((journal ?? []) as Record<string, unknown>[]);
  const valorisationsNorm = normalizeValorisations((valorisations ?? []) as Record<string, unknown>[]);
  const engine = computeEngine(journalNorm, valorisationsNorm, parametres);

  return { engine, membres: (membres ?? []) as Membre[], parametres };
}

// Variante de loadEngine() pour les contextes sans utilisateur connecté (ex: la
// route cron d'envoi mensuel automatique, appelée directement par Vercel — pas
// de cookie de session, donc pas d'auth.uid() pour la RLS). Utilise le client
// admin (clé de service, contourne la RLS) et lit la table `membres` complète
// (pas la vue membres_public) pour avoir accès à l'email de chacun.
export async function loadEngineAdmin(): Promise<{
  engine: EngineResult;
  membres: Membre[];
  parametres: Parametres;
}> {
  const supabase = createAdminClient();

  const [{ data: journal, error: eJournal }, { data: valorisations, error: eValor }, { data: parametresRows, error: eParam }, { data: membres, error: eMembres }] =
    await Promise.all([
      supabase.from('journal').select('*'),
      supabase.from('valorisations').select('*'),
      supabase.from('parametres').select('*').eq('id', 1).single(),
      supabase.from('membres').select('*'),
    ]);

  if (eJournal) throw eJournal;
  if (eValor) throw eValor;
  if (eParam) throw eParam;
  if (eMembres) throw eMembres;

  const parametres = normalizeParametres(parametresRows as Record<string, unknown>);
  const journalNorm = normalizeJournal((journal ?? []) as Record<string, unknown>[]);
  const valorisationsNorm = normalizeValorisations((valorisations ?? []) as Record<string, unknown>[]);
  const engine = computeEngine(journalNorm, valorisationsNorm, parametres);

  return { engine, membres: (membres ?? []) as Membre[], parametres };
}
