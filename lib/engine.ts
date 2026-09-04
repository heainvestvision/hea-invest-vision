// Moteur de calcul HEA Invest Vision — portage fidèle de la logique du prototype
// (parts / VL / cap table / pénalités). Vérifié pour produire les mêmes chiffres
// que le fichier Excel de référence et que le prototype Claude Artifact.
//
// Différence avec le prototype : là où le prototype identifiait un membre par son
// nom en texte libre (et devait exclure "COMPTES TITRES", "FRAIS DE DEPLACEMENT",
// "RESERVE" de la liste des membres), le schéma Supabase sépare proprement les
// dépôts/retraits (liés à un membre_id) des mouvements internes (membre_id = null,
// libelle_interne rempli) — donc plus besoin de cette exclusion par nom ici.

import type { EcritureJournal, Valorisation, Parametres } from './types';

export interface JournalEnrichi extends EcritureJournal {
  parts_calculees: number | null;
  en_attente: boolean;
}

export interface ValorisationEnrichie extends Valorisation {
  parts_circulation: number;
  vl_part: number;
}

export interface CapTableRow {
  membre_id: string;
  capital: number;
  parts: number;
  pct: number;
  valeur_position: number;
  gain: number;
  perf: number;
}

export interface EngineResult {
  valorisations: ValorisationEnrichie[];
  journal: JournalEnrichi[];
  capTable: CapTableRow[];
  pending: JournalEnrichi[];
  totals: {
    totalCapital: number;
    totalParts: number;
    totalValeur: number;
    plusValue: number;
    perfGlobale: number;
    vlPart: number;
    dateArrete: string;
    caisseTotal: number;
    caisseReserve: number;
  };
}

export function computeEngine(
  journalIn: EcritureJournal[],
  valorisationsIn: Valorisation[],
  parametres: Parametres
): EngineResult {
  const { parts_initiales: partsInitiales, capital_fondateur: capitalFondateur } = parametres;

  const journal: JournalEnrichi[] = journalIn.map((e) => ({
    ...e,
    parts_calculees: null,
    en_attente: false,
  }));

  journal.forEach((e) => {
    if (e.type !== 'Dépôt' && e.type !== 'Retrait' && e.type !== 'Attribution' && e.type !== 'Transfert') {
      e.parts_calculees = 0;
      return;
    }
    if (e.type === 'Retrait' || e.type === 'Attribution' || e.type === 'Transfert') {
      // Les parts sont fixées directement (pas dérivées de la VL comme un Dépôt) :
      // négatives pour un Retrait ou pour le cédant d'un Transfert, positives pour
      // une Attribution ou pour le receveur d'un Transfert.
      e.parts_calculees = e.parts ?? 0;
      return;
    }
    // Dépôt
    if (e.vague === 'Fondateur') {
      e.parts_calculees = (e.montant / capitalFondateur) * partsInitiales;
      return;
    }
    if (!e.date_effective) {
      e.parts_calculees = null;
      e.en_attente = true;
      return;
    }
    e.parts_calculees = null; // à résoudre via la VL applicable, ci-dessous
  });

  const valor = [...valorisationsIn].sort((a, b) => a.date.localeCompare(b.date));
  let prevVl: number | null = null;
  const results: ValorisationEnrichie[] = [];

  for (const row of valor) {
    const d = row.date;
    journal.forEach((e) => {
      if (
        e.type === 'Dépôt' &&
        e.vague === 'Post-fondation' &&
        e.date_effective === d &&
        e.parts_calculees === null
      ) {
        if (prevVl == null) {
          throw new Error('VL précédente introuvable pour ' + d);
        }
        e.parts_calculees = (e.montant - (e.frais_impute || 0)) / prevVl;
      }
    });

    const postSum = journal
      .filter(
        (e) =>
          e.type === 'Dépôt' &&
          e.vague === 'Post-fondation' &&
          e.parts_calculees !== null &&
          e.date_effective !== null &&
          e.date_effective <= d
      )
      .reduce((s, e) => s + (e.parts_calculees as number), 0);

    const retraitSum = journal
      .filter((e) => e.type === 'Retrait' && e.date_effective !== null && e.date_effective <= d)
      .reduce((s, e) => s + (e.parts_calculees || 0), 0);

    // Parts créées par attribution (reliquat de pénalité redistribué aux membres
    // restants lors d'un retrait — voir ajouterRetrait) : elles s'ajoutent bien aux
    // parts en circulation, exactement comme un dépôt ou un retrait.
    const attributionSum = journal
      .filter((e) => e.type === 'Attribution' && e.date_effective !== null && e.date_effective <= d)
      .reduce((s, e) => s + (e.parts_calculees || 0), 0);

    // Un transfert ne crée ni ne détruit de parts (une ligne négative chez le
    // cédant, une positive chez le receveur, même date) : sa somme est toujours
    // nulle. Inclus quand même explicitement, par cohérence avec les autres types
    // et pour rester correct si cette hypothèse changeait un jour.
    const transfertSum = journal
      .filter((e) => e.type === 'Transfert' && e.date_effective !== null && e.date_effective <= d)
      .reduce((s, e) => s + (e.parts_calculees || 0), 0);

    const partsCirc = partsInitiales + postSum + retraitSum + attributionSum + transfertSum;
    const vl = row.valeur_portefeuille / partsCirc;
    results.push({ ...row, parts_circulation: partsCirc, vl_part: vl });
    prevVl = vl;
  }

  if (!results.length) {
    throw new Error('Aucune valorisation disponible');
  }
  const last = results[results.length - 1];

  // Dépôts post-fondation dont la date de souscription tombe après la dernière
  // valorisation connue : on les résout à la dernière VL connue. Ceux qui n'ont
  // pas encore de date de souscription (en_attente) restent non résolus.
  journal.forEach((e) => {
    if (
      e.type === 'Dépôt' &&
      e.vague === 'Post-fondation' &&
      e.parts_calculees === null &&
      !e.en_attente
    ) {
      e.parts_calculees = (e.montant - (e.frais_impute || 0)) / last.vl_part;
    }
  });

  const pending = journal.filter((e) => e.en_attente);

  const byMember = new Map<string, { capital: number; parts: number }>();
  for (const e of journal) {
    if (
      (e.type === 'Dépôt' || e.type === 'Retrait' || e.type === 'Attribution' || e.type === 'Transfert') &&
      e.membre_id &&
      e.parts_calculees !== null
    ) {
      if (!byMember.has(e.membre_id)) byMember.set(e.membre_id, { capital: 0, parts: 0 });
      const m = byMember.get(e.membre_id)!;
      m.capital += e.montant - (e.frais_impute || 0);
      m.parts += e.parts_calculees;
    }
  }

  const totalPartsAll = [...byMember.values()].reduce((s, m) => s + m.parts, 0);
  const vlPart = last.vl_part;

  const capTable: CapTableRow[] = [...byMember.entries()]
    .map(([membre_id, v]) => {
      const pct = totalPartsAll > 0 ? v.parts / totalPartsAll : 0;
      const valeur_position = v.parts * vlPart;
      const gain = valeur_position - v.capital;
      const perf = v.capital !== 0 ? gain / v.capital : 0;
      return { membre_id, capital: v.capital, parts: v.parts, pct, valeur_position, gain, perf };
    })
    .sort((a, b) => b.capital - a.capital);

  const totalCapital = capTable.reduce((s, m) => s + m.capital, 0);
  const totalValeur = capTable.reduce((s, m) => s + m.valeur_position, 0);
  const plusValue = totalValeur - totalCapital;
  const perfGlobale = totalCapital !== 0 ? plusValue / totalCapital : 0;

  // Solde de caisse : chaque écriture du journal porte déjà le bon signe pour son
  // impact en caisse (dépôt +, retrait -, mouvement interne déjà signé). La somme
  // brute donne la trésorerie disponible, par opposition à la valeur du portefeuille
  // investi (issue des valorisations). Un Transfert est exclu de cette somme : son
  // montant (positif chez le cédant, négatif chez le receveur — voir plus haut) ne
  // représente pas de l'argent réel qui entre ou sort du club : c'est le coût
  // d'acquisition transmis d'un membre à l'autre (négatif chez le cédant, positif
  // chez le receveur) pour que le calcul de leur plus-value reste juste.
  const caisseTotal = journal
    .filter((e) => e.type !== 'Transfert')
    .reduce((s, e) => s + e.montant, 0);
  const caisseReserve = journal
    .filter((e) => e.type === 'Mouvement interne' && e.libelle_interne === 'Réserve')
    .reduce((s, e) => s + Math.abs(e.montant), 0);

  return {
    valorisations: results,
    journal,
    capTable,
    pending,
    totals: {
      totalCapital,
      totalParts: totalPartsAll,
      totalValeur,
      plusValue,
      perfGlobale,
      vlPart,
      dateArrete: last.date,
      caisseTotal,
      caisseReserve,
    },
  };
}

export function computePenalite(
  dateEffet: string,
  date1erDepot: string,
  parametres: Parametres
): { taux: number; years: number } {
  const years =
    (new Date(dateEffet).getTime() - new Date(date1erDepot).getTime()) /
    (365.25 * 24 * 3600 * 1000);
  let taux: number;
  if (years < 1) taux = parametres.penalite_moins_1an;
  else if (years < 2) taux = parametres.penalite_1a_2ans;
  else if (years < 3) taux = parametres.penalite_2a_3ans;
  else taux = parametres.penalite_plus_3ans;
  return { taux, years };
}
