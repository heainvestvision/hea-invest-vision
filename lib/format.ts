// Fonctions pures de formatage / dérivation — séparées de lib/data.ts pour rester
// utilisables depuis les Client Components (lib/data.ts importe next/headers via
// lib/supabase/server, ce qui casse le build si un composant client l'importe,
// même pour une seule fonction pure).
import type { EngineResult } from '@/lib/engine';

export function fmtFcfa(n: number): string {
  return Math.round(n).toLocaleString('fr-FR') + ' FCFA';
}
export function fmtNum(n: number, d = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
export function fmtPct(n: number, d = 2): string {
  return (n * 100).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
}
export function fmtDate(s: string): string {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w) => (w.length > 2 ? w[0] + w.slice(1).toLowerCase() : w))
    .join(' ');
}

// Prépare les points du graphique d'évolution de la VL par part, en signalant
// pour chaque date de valorisation si un dépôt a été souscrit et/ou un retrait
// effectué ce jour-là (utilisé pour colorer les points sur le graphique).
export function buildVlEvolution(
  engine: EngineResult
): { date: string; value: number; depot: number; retrait: number }[] {
  const valorisations = [...engine.valorisations].sort((a, b) => a.date.localeCompare(b.date));
  return valorisations.map((v) => {
    const depot = engine.journal
      .filter((e) => e.type === 'Dépôt' && e.date_effective === v.date)
      .reduce((s, e) => s + e.montant, 0);
    const retrait = engine.journal
      .filter((e) => e.type === 'Retrait' && e.date_effective === v.date)
      .reduce((s, e) => s + Math.abs(e.montant), 0);
    return { date: v.date, value: v.vl_part, depot, retrait };
  });
}
