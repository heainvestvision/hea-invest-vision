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

export async function mettreAJourEmail(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id'));
  const email = String(formData.get('email') || '').trim();

  const { error } = await supabase.from('membres').update({ email }).eq('id', id);
  if (error) throw error;

  revalidatePath('/membres');
}

// Bascule le statut admin d'un membre. Protégé contre le cas où le club se
// retrouverait sans aucun administrateur (le bouton est déjà désactivé côté
// interface dans ce cas précis — cette vérification est une seconde barrière
// côté serveur, au cas où l'action serait déclenchée autrement).
export async function basculerAdmin(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const id = String(formData.get('id'));
  const nouveauStatut = formData.get('nouveauStatut') === 'true';

  const { data: membreRow } = await supabase.from('membres').select('nom').eq('id', id).single();

  if (!nouveauStatut) {
    const { count } = await supabase
      .from('membres')
      .select('id', { count: 'exact', head: true })
      .eq('is_admin', true);
    if ((count ?? 0) <= 1) {
      throw new Error("Impossible de retirer le dernier administrateur du club.");
    }
  }

  const { error } = await supabase.from('membres').update({ is_admin: nouveauStatut }).eq('id', id);
  if (error) throw error;

  await logHistorique(
    `${nouveauStatut ? 'Ajout du statut admin pour' : 'Retrait du statut admin de'} ${membreRow?.nom ?? id}`,
    'Modification'
  );

  revalidatePath('/membres');
}
