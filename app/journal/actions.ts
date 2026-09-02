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

// Enregistre un dépôt reçu — reste "en attente" (date_effective = null) tant que
// l'admin n'a pas traité la souscription (voir souscrirePending ci-dessous), exactement
// comme dans le prototype : la VL appliquée dépend de la date de souscription, pas de
// la date de réception.
export async function ajouterDepot(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const membre_id = String(formData.get('membre_id'));
  const date = String(formData.get('date'));
  const montant = Number(formData.get('montant'));
  const moyen = String(formData.get('moyen'));

  const { error } = await supabase.from('journal').insert({
    membre_id,
    date,
    montant,
    type: 'Dépôt',
    moyen,
    vague: 'Post-fondation',
    parts: null,
    date_effective: null,
    frais_impute: 0,
  });
  if (error) throw error;

  const { data: membreRow } = await supabase.from('membres').select('nom').eq('id', membre_id).single();
  await logHistorique(`Dépôt de ${montant.toLocaleString('fr-FR')} FCFA — ${membreRow?.nom ?? membre_id} — ${date}`, 'Ajout');

  revalidatePath('/journal');
  revalidatePath('/');
}

// Souscrit tous les dépôts en attente sélectionnés à une date commune : leurs parts
// seront calculées à la VL applicable à cette date (résolu par computeEngine côté
// serveur lors de l'affichage — ici on se contente d'enregistrer la date_effective).
export async function souscrirePending(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const ids = formData.getAll('ids').map(String);
  const dateSouscription = String(formData.get('dateSouscription'));
  if (!ids.length || !dateSouscription) return;

  const { error } = await supabase
    .from('journal')
    .update({ date_effective: dateSouscription })
    .in('id', ids);
  if (error) throw error;

  await logHistorique(
    `${ids.length} dépôt${ids.length > 1 ? 's' : ''} souscrit${ids.length > 1 ? 's' : ''} au ${dateSouscription}`,
    'Souscription'
  );

  revalidatePath('/journal');
  revalidatePath('/');
}

export async function ajouterMouvement(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const libelle = String(formData.get('libelle'));
  const date = String(formData.get('date'));
  const montant = Number(formData.get('montant'));
  const moyen = String(formData.get('moyen'));

  const { error } = await supabase.from('journal').insert({
    membre_id: null,
    libelle_interne: libelle,
    date,
    montant,
    type: 'Mouvement interne',
    moyen,
    vague: '-',
    parts: 0,
    date_effective: date,
    frais_impute: 0,
  });
  if (error) throw error;

  await logHistorique(`Mouvement interne de ${montant.toLocaleString('fr-FR')} FCFA — ${libelle} — ${date}`, 'Ajout');
  revalidatePath('/journal');
  revalidatePath('/');
}

export async function supprimerEcriture(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const id = String(formData.get('id'));

  const { data: entry } = await supabase.from('journal').select('*').eq('id', id).single();
  const { error } = await supabase.from('journal').delete().eq('id', id);
  if (error) throw error;

  if (entry) {
    await logHistorique(
      `${entry.type} — ${Number(entry.montant).toLocaleString('fr-FR')} FCFA — ${entry.date}`,
      'Suppression'
    );
  }
  revalidatePath('/journal');
  revalidatePath('/');
}
