// Vérifie le mécanisme de Transfert de titre : la cap table totale (capital et
// parts) doit rester strictement inchangée après un transfert (c'est un pur
// déplacement entre deux membres), et la trésorerie (caisseTotal) ne doit pas
// bouger puisqu'aucun argent réel ne circule.
import { execSync } from 'node:child_process';

execSync('npx --yes esbuild lib/engine.ts --bundle --platform=node --format=esm --outfile=/tmp/engine-test-build.mjs', {
  cwd: new URL('..', import.meta.url).pathname,
  stdio: 'inherit',
});
const { computeEngine } = await import('/tmp/engine-test-build.mjs?t=' + Date.now());

const parametres = {
  parts_initiales: 1000,
  capital_fondateur: 1000000,
  vl_implicite: 1000,
  frais_entree: 0,
  preavis_jours: 30,
  penalite_moins_1an: 0.05,
  penalite_1a_2ans: 0.03,
  penalite_2a_3ans: 0.01,
  penalite_plus_3ans: 0,
};

const valorisations = [
  { id: 'v1', date: '2025-01-01', valeur_portefeuille: 1000000, evenement_capital: null, type_evenement: null },
  { id: 'v2', date: '2026-01-01', valeur_portefeuille: 1650000, evenement_capital: null, type_evenement: null },
];

// 3 fondateurs A, B, C — 1000 parts, capital 1 000 000 FCFA au total.
const journalBase = [
  { id: 'a1', date: '2025-01-01', membre_id: 'A', libelle_interne: null, montant: 500000, type: 'Dépôt', moyen: 'Virement', vague: 'Fondateur', parts: null, date_effective: '2025-01-01', frais_impute: 0 },
  { id: 'b1', date: '2025-01-01', membre_id: 'B', libelle_interne: null, montant: 300000, type: 'Dépôt', moyen: 'Virement', vague: 'Fondateur', parts: null, date_effective: '2025-01-01', frais_impute: 0 },
  { id: 'c1', date: '2025-01-01', membre_id: 'C', libelle_interne: null, montant: 200000, type: 'Dépôt', moyen: 'Virement', vague: 'Fondateur', parts: null, date_effective: '2025-01-01', frais_impute: 0 },
];

function run(journal) {
  return computeEngine(journal, valorisations, parametres);
}

const before = run(journalBase);
const capBefore = before.capTable.find((c) => c.membre_id === 'A');
const partsMax = capBefore.parts;
const capitalA = capBefore.capital;
const coutParPart = capitalA / partsMax;

console.log('--- Avant transfert ---');
console.log('A: capital', capitalA, 'parts', partsMax, 'coût/part', coutParPart.toFixed(4));
console.log('Total capital:', before.totals.totalCapital, 'Total parts:', before.totals.totalParts, 'Caisse:', before.totals.caisseTotal);

// A transfère 40 parts à D (nouveau membre), même date que la 2e valorisation.
const partsTransferees = 40;
const coutTransfere = Math.round(partsTransferees * coutParPart);

const journalAvecTransfert = [
  ...journalBase,
  { id: 't1', date: '2026-01-01', membre_id: 'A', libelle_interne: null, montant: -coutTransfere, type: 'Transfert', moyen: null, vague: '-', parts: -partsTransferees, date_effective: '2026-01-01', frais_impute: 0, groupe_id: 'g1' },
  { id: 't2', date: '2026-01-01', membre_id: 'D', libelle_interne: null, montant: coutTransfere, type: 'Transfert', moyen: null, vague: '-', parts: partsTransferees, date_effective: '2026-01-01', frais_impute: 0, groupe_id: 'g1' },
];

const after = run(journalAvecTransfert);
const capA = after.capTable.find((c) => c.membre_id === 'A');
const capD = after.capTable.find((c) => c.membre_id === 'D');

console.log('\n--- Après transfert de', partsTransferees, 'parts de A vers D (coût transféré', coutTransfere, 'FCFA) ---');
console.log('A: capital', capA.capital, 'parts', capA.parts);
console.log('D: capital', capD.capital, 'parts', capD.parts);
console.log('Total capital:', after.totals.totalCapital, 'Total parts:', after.totals.totalParts, 'Caisse:', after.totals.caisseTotal);

let ok = true;
function check(label, cond) {
  if (!cond) ok = false;
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}`);
}

check('Total capital inchangé', Math.abs(after.totals.totalCapital - before.totals.totalCapital) < 1);
check('Total parts inchangé', Math.abs(after.totals.totalParts - before.totals.totalParts) < 1e-9);
check('Caisse inchangée (transfert exclu)', Math.abs(after.totals.caisseTotal - before.totals.caisseTotal) < 1);
check('Parts de A diminuées de ' + partsTransferees, Math.abs(capA.parts - (partsMax - partsTransferees)) < 1e-9);
check('Parts de D = ' + partsTransferees, Math.abs(capD.parts - partsTransferees) < 1e-9);
check('Capital de A diminué de ' + coutTransfere, Math.abs(capA.capital - (capitalA - coutTransfere)) < 1);
check('Capital de D = ' + coutTransfere, Math.abs(capD.capital - coutTransfere) < 1);
check('VL par part inchangée (transfert neutre pour tout le monde)', Math.abs(after.totals.vlPart - before.totals.vlPart) < 1e-9);

console.log(ok ? '\n✅ Mécanisme de transfert vérifié.' : '\n❌ ÉCART DÉTECTÉ — à corriger avant de déployer.');
process.exit(ok ? 0 : 1);
