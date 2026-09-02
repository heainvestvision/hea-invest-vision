// Vérifie que le moteur porté (lib/engine.ts) reproduit exactement les mêmes
// totaux que le prototype pour les données réelles actuelles. Exécuté avec les
// données brutes du prototype (../../seed_data.json), adaptées au format attendu
// par computeEngine (membre_id = nom, suffisant pour ce test de non-régression).

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// Compile engine.ts -> engine.mjs à la volée via esbuild (déjà présent via next/swc? on
// utilise simplement `npx tsc` en mode transpile-only pour ce test ponctuel).
execSync('npx --yes esbuild lib/engine.ts --bundle --platform=node --format=esm --outfile=/tmp/engine-test-build.mjs', {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'inherit',
});
const { computeEngine } = await import('/tmp/engine-test-build.mjs');

const raw = JSON.parse(readFileSync(new URL('../../seed_data.json', import.meta.url)));

const journal = raw.journal.map((e, i) => ({
  id: 'j' + i,
  date: e.date,
  membre_id: e.type === 'Mouvement interne' ? null : e.nom,
  libelle_interne: e.type === 'Mouvement interne' ? e.nom : null,
  montant: e.montant,
  type: e.type,
  moyen: e.moyen ?? null,
  vague: e.vague ?? null,
  parts: e.dateEffective ? e.partsAchetees : null,
  date_effective: e.dateEffective ?? null,
  frais_impute: e.fraisImpute ?? 0,
}));

const valorisations = raw.valorisations.map((v, i) => ({
  id: 'v' + i,
  date: v.date,
  valeur_portefeuille: v.valeurPortefeuille,
  evenement_capital: v.evenementCapital ?? null,
  type_evenement: v.typeEvenement ?? null,
}));

const p = raw.parametres;
const parametres = {
  parts_initiales: p.partsInitiales,
  capital_fondateur: p.capitalFondateur,
  vl_implicite: p.vlImplicite,
  frais_entree: p.fraisEntree,
  preavis_jours: p.preavisJours,
  penalite_moins_1an: p.penaliteMoins1an,
  penalite_1a_2ans: p.penalite1a2ans,
  penalite_2a_3ans: p.penalite2a3ans,
  penalite_plus_3ans: p.penalitePlus3ans,
};

const engine = computeEngine(journal, valorisations, parametres);

const fmt = (n) => Math.round(n).toLocaleString('fr-FR');
console.log('--- Résultat moteur porté (TypeScript) ---');
console.log('Date arrêté          :', engine.totals.dateArrete);
console.log('Capital total apporté:', fmt(engine.totals.totalCapital), 'FCFA');
console.log('Valeur portefeuille  :', fmt(engine.totals.totalValeur), 'FCFA');
console.log('VL par part          :', engine.totals.vlPart.toFixed(4));
console.log('Plus-value latente   :', fmt(engine.totals.plusValue), 'FCFA');
console.log('Performance globale  :', (engine.totals.perfGlobale * 100).toFixed(2) + ' %');
console.log('Nb membres cap table :', engine.capTable.length);
console.log('Dépôts en attente    :', engine.pending.length);

// --- Attendu (relevé sur le prototype publié) ---
const expected = {
  totalCapital: 3285000,
  totalValeur: 4549987,
  vlPart: 192.6355,
  plusValue: 1264987,
  perfGlobale: 0.3851,
};

let ok = true;
function check(label, actual, exp, tol) {
  const diff = Math.abs(actual - exp);
  const pass = diff <= tol;
  if (!pass) ok = false;
  console.log(`${pass ? 'OK  ' : 'FAIL'} ${label}: ${actual} (attendu ${exp}, écart ${diff})`);
}
check('totalCapital', Math.round(engine.totals.totalCapital), expected.totalCapital, 1);
check('totalValeur', Math.round(engine.totals.totalValeur), expected.totalValeur, 1);
check('vlPart', Number(engine.totals.vlPart.toFixed(4)), expected.vlPart, 0.0001);
check('plusValue', Math.round(engine.totals.plusValue), expected.plusValue, 1);
check('perfGlobale', Number(engine.totals.perfGlobale.toFixed(4)), expected.perfGlobale, 0.0001);

console.log(ok ? '\n✅ Le moteur porté reproduit exactement les chiffres du prototype.' : '\n❌ ÉCART DÉTECTÉ — à corriger avant de déployer.');
process.exit(ok ? 0 : 1);
