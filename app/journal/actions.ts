'use server';

import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/current-membre';
import { createClient } from '@/lib/supabase/server';
import { loadEngine, titleCase } from '@/lib/data';
import { computePenalite } from '@/lib/engine';
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
//
// Si des frais ont été engagés pour réaliser l'opération (frais bancaires, déplacement
// pour déposer l'argent...), ils sont répartis à parts égales entre les dépôts de cette
// vague (pas proportionnellement au montant de chacun) — exactement comme dans le
// prototype. La part de ces frais qui correspond à une dépense réelle crée une écriture
// "Mouvement interne" négative ; le reste, non dépensé, part automatiquement en réserve.
export async function souscrirePending(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const ids = formData.getAll('ids').map(String);
  const dateSouscription = String(formData.get('dateSouscription'));
  if (!ids.length || !dateSouscription) return;

  const fraisTotal = Number(formData.get('fraisTotal')) || 0;
  const fraisReel = Number(formData.get('fraisReel')) || 0;
  let fraisLibelle = String(formData.get('fraisLibelle') ?? '').trim();
  if (fraisLibelle === '__autre__') {
    fraisLibelle = String(formData.get('fraisLibelleAutre') ?? '').trim() || 'Frais';
  }

  if (fraisTotal > 0 && fraisReel > fraisTotal) {
    throw new Error('La dépense réelle ne peut pas dépasser les frais totaux engagés.');
  }

  const { error } = await supabase
    .from('journal')
    .update({ date_effective: dateSouscription })
    .in('id', ids);
  if (error) throw error;

  if (fraisTotal > 0) {
    const parDepot = fraisTotal / ids.length;
    const { error: eFrais } = await supabase
      .from('journal')
      .update({ frais_impute: parDepot })
      .in('id', ids);
    if (eFrais) throw eFrais;

    if (fraisReel > 0) {
      const { error: eReel } = await supabase.from('journal').insert({
        membre_id: null,
        libelle_interne: fraisLibelle || 'Frais de déplacement',
        date: dateSouscription,
        montant: -fraisReel,
        type: 'Mouvement interne',
        moyen: 'Caisse',
        vague: '-',
        parts: 0,
        date_effective: dateSouscription,
        frais_impute: 0,
      });
      if (eReel) throw eReel;
    }

    const reserve = fraisTotal - fraisReel;
    if (reserve > 0) {
      const { error: eReserve } = await supabase.from('journal').insert({
        membre_id: null,
        libelle_interne: 'Réserve',
        date: dateSouscription,
        montant: -reserve,
        type: 'Mouvement interne',
        moyen: 'Caisse',
        vague: '-',
        parts: 0,
        date_effective: dateSouscription,
        frais_impute: 0,
      });
      if (eReserve) throw eReserve;
    }
  }

  await logHistorique(
    `${ids.length} dépôt${ids.length > 1 ? 's' : ''} souscrit${ids.length > 1 ? 's' : ''} au ${dateSouscription}` +
      (fraisTotal > 0
        ? ` — frais total ${fraisTotal.toLocaleString('fr-FR')} FCFA (réel ${fraisReel.toLocaleString('fr-FR')} FCFA, réserve ${(fraisTotal - fraisReel).toLocaleString('fr-FR')} FCFA)`
        : ''),
    'Souscription'
  );

  revalidatePath('/journal');
  revalidatePath('/');
  revalidatePath('/captable');
}

// Enregistre le retrait (sortie) d'un membre : la pénalité est calculée automatiquement
// selon l'ancienneté du premier dépôt (voir computePenalite dans lib/engine.ts, mêmes
// paliers que le prototype), et le montant net est versé immédiatement — contrairement
// aux dépôts, un retrait n'attend pas de souscription groupée.
//
// Un seul retrait génère en réalité plusieurs écritures, pour que l'argent soit
// traçable de bout en bout dans le journal :
//  1. Le retrait lui-même (parts et montant net en négatif, imputés au membre).
//  2. Une sortie du compte-titres vers la caisse, pour le montant net ET les frais
//     réels engagés (virement, déplacement...) — c'est de là que vient réellement
//     l'argent, pas de la caisse elle-même qui n'a normalement pas ces sommes
//     disponibles puisqu'elles sont investies.
//  3. Si des frais réels ont été engagés, une écriture qui les impute (négatif).
//  4. Le reliquat de la pénalité (pénalité retenue moins les frais réels) n'est pas
//     versé à qui que ce soit : il est reconverti en nouvelles parts, réparties à
//     parts strictement égales entre tous les autres membres encore présents dans
//     le club (une écriture "Attribution" par membre, montant = 0 — un gain pur,
//     sans coût en capital pour eux). C'est ce qui compense concrètement les membres
//     restants pour la sortie anticipée d'un des leurs, au lieu de rester dilué et
//     invisible dans la VL de tout le monde.
export async function ajouterRetrait(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const membre_id = String(formData.get('membre_id'));
  const date = String(formData.get('date'));
  const parts = Number(formData.get('parts'));
  const fraisReels = Math.round(Number(formData.get('fraisReels')) || 0);
  if (!membre_id || !date || !parts || parts <= 0) return;
  if (fraisReels < 0) throw new Error('Les frais réels ne peuvent pas être négatifs.');

  const { engine, membres, parametres } = await loadEngine();
  const membre = membres.find((m) => m.id === membre_id);
  const capRow = engine.capTable.find((c) => c.membre_id === membre_id);
  const partsMax = capRow?.parts ?? 0;

  if (!membre) throw new Error('Membre introuvable.');
  if (parts > partsMax + 1e-9) {
    throw new Error(
      `Retrait impossible : ${parts.toLocaleString('fr-FR')} parts demandées, maximum disponible ${partsMax.toLocaleString('fr-FR')} parts.`
    );
  }

  const { taux } = computePenalite(date, membre.date_1er_depot ?? date, parametres);
  const valeurBrute = parts * engine.totals.vlPart;
  const penalite = valeurBrute * taux;

  if (fraisReels > penalite + 1e-6) {
    throw new Error(
      `Les frais réels (${fraisReels.toLocaleString('fr-FR')} FCFA) ne peuvent pas dépasser la pénalité retenue ` +
        `(${Math.round(penalite).toLocaleString('fr-FR')} FCFA).`
    );
  }

  const montantNet = Math.round(valeurBrute - penalite);
  const reliquat = penalite - fraisReels;

  const nomMembre = titleCase(membre.nom);
  // Toutes les écritures ci-dessous appartiennent à la même opération : elles
  // partagent un groupe_id commun pour pouvoir être supprimées ensemble en un clic
  // (voir supprimerGroupe ci-dessous) si ce retrait doit être annulé.
  const groupeId = randomUUID();
  const rows: Record<string, unknown>[] = [
    {
      membre_id,
      date,
      montant: -montantNet,
      type: 'Retrait',
      moyen: 'Virement',
      vague: '-',
      parts: -parts,
      date_effective: date,
      frais_impute: 0,
      groupe_id: groupeId,
    },
    {
      membre_id: null,
      libelle_interne: `Sortie du compte-titres (retrait de ${nomMembre})`,
      date,
      montant: montantNet + fraisReels,
      type: 'Mouvement interne',
      moyen: 'Caisse',
      vague: '-',
      parts: 0,
      date_effective: date,
      frais_impute: 0,
      groupe_id: groupeId,
    },
  ];

  if (fraisReels > 0) {
    rows.push({
      membre_id: null,
      libelle_interne: `Frais de retrait (${nomMembre})`,
      date,
      montant: -fraisReels,
      type: 'Mouvement interne',
      moyen: 'Caisse',
      vague: '-',
      parts: 0,
      date_effective: date,
      frais_impute: 0,
      groupe_id: groupeId,
    });
  }

  const membresRestants = engine.capTable.filter((c) => c.membre_id !== membre_id && c.parts > 1e-9);
  let partsParMembre = 0;
  if (reliquat > 0 && membresRestants.length > 0) {
    partsParMembre = reliquat / engine.totals.vlPart / membresRestants.length;
    for (const m of membresRestants) {
      rows.push({
        membre_id: m.membre_id,
        libelle_interne: null,
        date,
        montant: 0,
        type: 'Attribution',
        moyen: null,
        vague: '-',
        parts: partsParMembre,
        date_effective: date,
        frais_impute: 0,
        groupe_id: groupeId,
      });
    }
  }

  const { error } = await supabase.from('journal').insert(rows);
  if (error) throw error;

  await logHistorique(
    `Retrait de ${parts.toLocaleString('fr-FR')} parts (${montantNet.toLocaleString('fr-FR')} FCFA net) — ${nomMembre} — ${date}` +
      (fraisReels > 0 ? ` — frais réels ${fraisReels.toLocaleString('fr-FR')} FCFA` : '') +
      (reliquat > 0
        ? membresRestants.length > 0
          ? ` — reliquat ${Math.round(reliquat).toLocaleString('fr-FR')} FCFA réparti en ${partsParMembre.toFixed(4)} part(s) chacun entre ${membresRestants.length} membre(s) restant(s)`
          : ` — reliquat ${Math.round(reliquat).toLocaleString('fr-FR')} FCFA non réparti (aucun autre membre)`
        : ''),
    'Ajout'
  );

  revalidatePath('/journal');
  revalidatePath('/');
  revalidatePath('/captable');
  revalidatePath('/rapport');
}

// Enregistre un transfert de titre : un membre (le cédant) cède tout ou partie de
// ses parts à un autre membre (le receveur, déjà présent dans le club ou nouveau —
// sa fiche est alors créée à la volée). Contrairement à un retrait, rien ne sort du
// compte-titres et aucune pénalité ne s'applique : les parts changent juste de
// propriétaire, à l'intérieur du fonds.
//
// Le coût d'acquisition (utilisé pour calculer la plus-value de chacun) est
// transmis au prorata : le cédant garde son coût moyen actuel par part
// (capital / parts, tel que retourné par la cap table), et cède au receveur ce
// coût moyen multiplié par les parts transférées. Le total capital du fonds ne
// change pas (ce qui sort de l'un entre exactement chez l'autre) — voir
// caisseTotal dans lib/engine.ts qui exclut ce montant de la trésorerie, puisque
// aucun argent réel ne bouge.
//
// Le prix indicatif éventuellement saisi (ce que le receveur paie au cédant) n'est
// enregistré qu'à titre informatif dans l'historique : cet argent passe entre les
// deux membres, jamais par la caisse du club.
export async function ajouterTransfert(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const cedantId = String(formData.get('cedant_id'));
  const date = String(formData.get('date'));
  const parts = Number(formData.get('parts'));
  const modeReceveur = String(formData.get('modeReceveur'));
  const prixIndicatif = Math.round(Number(formData.get('prixIndicatif')) || 0);

  if (!cedantId || !date || !parts || parts <= 0) return;
  if (prixIndicatif < 0) throw new Error('Le prix indicatif ne peut pas être négatif.');

  const { engine, membres } = await loadEngine();
  const cedant = membres.find((m) => m.id === cedantId);
  const capRowCedant = engine.capTable.find((c) => c.membre_id === cedantId);
  const partsCedant = capRowCedant?.parts ?? 0;
  const capitalCedant = capRowCedant?.capital ?? 0;

  if (!cedant) throw new Error('Membre cédant introuvable.');
  if (parts > partsCedant + 1e-9) {
    throw new Error(
      `Transfert impossible : ${parts.toLocaleString('fr-FR')} parts demandées, maximum disponible ${partsCedant.toLocaleString('fr-FR')} parts.`
    );
  }

  const coutParPart = partsCedant > 0 ? capitalCedant / partsCedant : 0;
  const coutTransfere = Math.round(parts * coutParPart);

  let receveurId: string;
  let nomReceveur: string;

  if (modeReceveur === 'nouveau') {
    const nom = String(formData.get('nouveauNom') || '').trim().toUpperCase();
    const prenom = String(formData.get('nouveauPrenom') || '').trim() || null;
    const email = String(formData.get('nouveauEmail') || '').trim() || null;
    if (!nom) throw new Error('Le nom du nouveau membre est requis.');

    const { data: maxNumRow } = await supabase
      .from('membres')
      .select('num')
      .order('num', { ascending: false })
      .limit(1)
      .single();
    const nextNum = (maxNumRow?.num ?? 0) + 1;

    const { data: nouveauMembre, error: eCreate } = await supabase
      .from('membres')
      .insert({ nom, prenom, email, num: nextNum, date_1er_depot: date, is_admin: false })
      .select('id, nom')
      .single();
    if (eCreate) throw eCreate;
    receveurId = nouveauMembre.id;
    nomReceveur = titleCase(nouveauMembre.nom);
  } else {
    receveurId = String(formData.get('receveur_id'));
    if (!receveurId) throw new Error('Membre receveur introuvable.');
    if (receveurId === cedantId) throw new Error('Le cédant et le receveur doivent être différents.');
    const receveur = membres.find((m) => m.id === receveurId);
    if (!receveur) throw new Error('Membre receveur introuvable.');
    nomReceveur = titleCase(receveur.nom);
  }

  const groupeId = randomUUID();
  const nomCedant = titleCase(cedant.nom);

  const rows: Record<string, unknown>[] = [
    {
      membre_id: cedantId,
      date,
      montant: -coutTransfere,
      type: 'Transfert',
      moyen: null,
      vague: '-',
      parts: -parts,
      date_effective: date,
      frais_impute: 0,
      groupe_id: groupeId,
    },
    {
      membre_id: receveurId,
      date,
      montant: coutTransfere,
      type: 'Transfert',
      moyen: null,
      vague: '-',
      parts,
      date_effective: date,
      frais_impute: 0,
      groupe_id: groupeId,
    },
  ];

  const { error } = await supabase.from('journal').insert(rows);
  if (error) throw error;

  await logHistorique(
    `Transfert de ${parts.toLocaleString('fr-FR')} parts de ${nomCedant} vers ${nomReceveur} — ${date} — coût transféré ${coutTransfere.toLocaleString('fr-FR')} FCFA` +
      (prixIndicatif > 0
        ? ` — prix indicatif convenu entre eux : ${prixIndicatif.toLocaleString('fr-FR')} FCFA (non comptabilisé dans le club)`
        : ''),
    'Ajout'
  );

  revalidatePath('/journal');
  revalidatePath('/');
  revalidatePath('/captable');
  revalidatePath('/rapport');
  revalidatePath('/membres');
}

// Supprime en une seule fois toutes les écritures partageant un même groupe_id —
// c'est-à-dire toutes celles issues d'une seule opération multi-lignes (un retrait
// ou un transfert). Nécessaire parce que supprimer ces écritures une par une avec
// supprimerEcriture laisserait les comptes déséquilibrés entre deux suppressions
// (ex : le retrait supprimé mais pas la sortie compte-titres correspondante).
export async function supprimerGroupe(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const groupeId = String(formData.get('groupe_id'));
  if (!groupeId) return;

  const { data: entries } = await supabase.from('journal').select('*').eq('groupe_id', groupeId);
  const { error } = await supabase.from('journal').delete().eq('groupe_id', groupeId);
  if (error) throw error;

  if (entries && entries.length > 0) {
    await logHistorique(
      `Groupe de ${entries.length} écritures liées supprimé (${entries[0].type}) — ${entries[0].date}`,
      'Suppression'
    );
  }

  revalidatePath('/journal');
  revalidatePath('/');
  revalidatePath('/captable');
  revalidatePath('/rapport');
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
