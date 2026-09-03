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

// Met à jour les paramètres du club (ligne unique, id=1).
//
// Le capital fondateur n'est JAMAIS modifiable depuis ce formulaire — il n'y a même
// pas de champ pour lui côté interface, ni ici côté serveur — car il fixe
// définitivement la conversion FCFA → parts appliquée à chaque fondateur au moment
// de la création du club (parts = montant / capital_fondateur × parts_initiales) ;
// le changer romprait ce lien pour de vrai, pour tout le monde, rétroactivement.
//
// Les parts initiales, elles, PEUVENT changer : comme la VL n'est jamais figée dans
// le temps (toujours recalculée en direct par computeEngine), changer les parts
// initiales revient à un simple changement d'unité — un "split" — qui rescale tout
// le monde de façon strictement identique : ni le pourcentage détenu, ni la valeur en
// FCFA de qui que ce soit ne change. Seul le nombre de parts affiché change (voir
// l'avertissement côté client dans ParametresForm.tsx avant de valider ce champ).
export async function mettreAJourParametres(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const { data: avant, error: eAvant } = await supabase.from('parametres').select('*').eq('id', 1).single();
  if (eAvant) throw eAvant;

  const partsInitiales = Number(formData.get('parts_initiales'));
  const vlImplicite = Number(formData.get('vl_implicite')) || 0;
  const fraisEntreePct = Number(formData.get('frais_entree_pct')) || 0;
  const preavisJours = Number(formData.get('preavis_jours'));
  const penaliteMoins1anPct = Number(formData.get('penalite_moins_1an_pct')) || 0;
  const penalite1a2ansPct = Number(formData.get('penalite_1a_2ans_pct')) || 0;
  const penalite2a3ansPct = Number(formData.get('penalite_2a_3ans_pct')) || 0;
  const penalitePlus3ansPct = Number(formData.get('penalite_plus_3ans_pct')) || 0;

  if (!partsInitiales || partsInitiales <= 0) {
    throw new Error('Les parts initiales doivent être un nombre positif.');
  }
  if (preavisJours < 0 || Number.isNaN(preavisJours)) {
    throw new Error('Le préavis doit être un nombre de jours positif ou nul.');
  }

  const nouveaux = {
    parts_initiales: partsInitiales,
    vl_implicite: vlImplicite,
    frais_entree: fraisEntreePct / 100,
    preavis_jours: preavisJours,
    penalite_moins_1an: penaliteMoins1anPct / 100,
    penalite_1a_2ans: penalite1a2ansPct / 100,
    penalite_2a_3ans: penalite2a3ansPct / 100,
    penalite_plus_3ans: penalitePlus3ansPct / 100,
  };

  const { error } = await supabase.from('parametres').update(nouveaux).eq('id', 1);
  if (error) throw error;

  const fmtP = (n: number) => (n * 100).toLocaleString('fr-FR');
  const changements: string[] = [];
  if (Number(avant.parts_initiales) !== nouveaux.parts_initiales) {
    changements.push(
      `parts initiales ${Number(avant.parts_initiales).toLocaleString('fr-FR')} → ${nouveaux.parts_initiales.toLocaleString('fr-FR')}`
    );
  }
  if (Number(avant.penalite_moins_1an) !== nouveaux.penalite_moins_1an) {
    changements.push(`pénalité -1an ${fmtP(Number(avant.penalite_moins_1an))}% → ${fmtP(nouveaux.penalite_moins_1an)}%`);
  }
  if (Number(avant.penalite_1a_2ans) !== nouveaux.penalite_1a_2ans) {
    changements.push(`pénalité 1-2ans ${fmtP(Number(avant.penalite_1a_2ans))}% → ${fmtP(nouveaux.penalite_1a_2ans)}%`);
  }
  if (Number(avant.penalite_2a_3ans) !== nouveaux.penalite_2a_3ans) {
    changements.push(`pénalité 2-3ans ${fmtP(Number(avant.penalite_2a_3ans))}% → ${fmtP(nouveaux.penalite_2a_3ans)}%`);
  }
  if (Number(avant.penalite_plus_3ans) !== nouveaux.penalite_plus_3ans) {
    changements.push(`pénalité +3ans ${fmtP(Number(avant.penalite_plus_3ans))}% → ${fmtP(nouveaux.penalite_plus_3ans)}%`);
  }
  if (Number(avant.vl_implicite) !== nouveaux.vl_implicite) {
    changements.push(`VL implicite ${Number(avant.vl_implicite).toLocaleString('fr-FR')} → ${nouveaux.vl_implicite.toLocaleString('fr-FR')}`);
  }
  if (Number(avant.frais_entree) !== nouveaux.frais_entree) {
    changements.push(`frais d'entrée ${fmtP(Number(avant.frais_entree))}% → ${fmtP(nouveaux.frais_entree)}%`);
  }
  if (Number(avant.preavis_jours) !== nouveaux.preavis_jours) {
    changements.push(`préavis ${avant.preavis_jours}j → ${preavisJours}j`);
  }

  await logHistorique(
    changements.length > 0
      ? `Paramètres du club modifiés — ${changements.join(', ')}`
      : 'Paramètres du club enregistrés (aucun changement)',
    'Modification'
  );

  revalidatePath('/parametres');
  revalidatePath('/');
  revalidatePath('/captable');
  revalidatePath('/journal');
  revalidatePath('/valorisations');
  revalidatePath('/simulateurs');
  revalidatePath('/rapport');
  revalidatePath('/avis');
}
