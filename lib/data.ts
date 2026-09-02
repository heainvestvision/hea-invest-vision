import { createClient } from '@/lib/supabase/server';
import { computeEngine, type EngineResult } from '@/lib/engine';
import type { Membre, Parametres } from '@/lib/types';

export * from '@/lib/format';

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

  const parametres = parametresRows as unknown as Parametres;
  const engine = computeEngine(journal ?? [], valorisations ?? [], parametres);

  return { engine, membres: (membres ?? []) as Membre[], parametres };
}
