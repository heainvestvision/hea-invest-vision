'use server';

import { requireAdmin } from '@/lib/current-membre';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

async function logHistorique(detail: string, action: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from('historique').insert({ action, detail, actor_id: user?.id ?? null });
}

function revalidateTout() {
  revalidatePath('/valorisations');
  revalidatePath('/');
  revalidatePath('/captable');
  revalidatePath('/journal');
}

// Enregistre une nouvelle valorisation (valeur du portefeuille à une date donnée) —
// exactement comme dans le prototype, c'est cette saisie hebdomadaire qui permet à
// computeEngine() (lib/engine.ts) de recalculer la VL par part et de résoudre les
// dépôts post-fondation en attente de souscription à la bonne valeur.
export async function ajouterValorisation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const date = String(formData.get('date'));
  const valeur_portefeuille = Number(formData.get('valeur_portefeuille'));
  const evenementRaw = String(formData.get('evenement_capital') ?? '').trim();
  const typeRaw = String(formData.get('type_evenement') ?? '').trim();

  const { error } = await supabase.from('valorisations').insert({
    date,
    valeur_portefeuille,
    evenement_capital: evenementRaw ? Number(evenementRaw) : null,
    type_evenement: typeRaw || null,
  });
  if (error) throw error;

  await logHistorique(
    `Valorisation du ${date} — ${valeur_portefeuille.toLocaleString('fr-FR')} FCFA${typeRaw ? ` (${typeRaw})` : ''}`,
    'Ajout'
  );

  revalidateTout();
}

export async function supprimerValorisation(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get('id'));

  const { data: entry } = await supabase.from('valorisations').select('*').eq('id', id).single();
  const { error } = await supabase.from('valorisations').delete().eq('id', id);
  if (error) throw error;

  if (entry) {
    await logHistorique(
      `Valorisation du ${entry.date} — ${Number(entry.valeur_portefeuille).toLocaleString('fr-FR')} FCFA`,
      'Suppression'
    );
  }
  revalidateTout();
}
