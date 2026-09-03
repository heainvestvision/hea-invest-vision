'use server';

import { requireAdmin } from '@/lib/current-membre';
import { envoyerTousLesRapports } from '@/lib/monthly-reports';
import { revalidatePath } from 'next/cache';

// Déclenche un envoi immédiat (hors planification) des rapports individuels à tous
// les membres ayant un email enregistré — pour un cas exceptionnel où un admin veut
// envoyer un rapport en dehors du cycle mensuel automatique, ou pour vérifier que
// l'envoi fonctionne réellement sans attendre la fin du mois.
export async function envoyerRapportsMaintenant() {
  const membre = await requireAdmin();
  await envoyerTousLesRapports('Manuel', membre.auth_user_id);
  revalidatePath('/historique');
}
