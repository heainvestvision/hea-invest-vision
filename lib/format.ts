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

// Prépare les points du graphique d'évolution de la VL par part, en signalant pour
// chaque date de valorisation un vrai événement de capital dans le compte-titres —
// positif (evenement_capital > 0) pour un dépôt/déploiement, négatif pour un retrait
// — via le champ evenement_capital / type_evenement de la ligne de valorisation
// elle-même. On ne se base plus du tout sur les dates individuelles des écritures du
// journal (dépôt ou retrait) : ces dates peuvent coïncider par hasard avec une date
// de valorisation sans qu'aucun mouvement réel n'ait eu lieu ce jour-là dans le
// compte-titres — seule la ligne de valorisation, saisie et confirmée par l'admin,
// fait foi.
export function buildVlEvolution(
  engine: EngineResult
): {
  date: string;
  value: number;
  depot: number;
  depotLabel: string | null;
  retrait: number;
  retraitLabel: string | null;
}[] {
  const valorisations = [...engine.valorisations].sort((a, b) => a.date.localeCompare(b.date));
  return valorisations.map((v) => {
    const evt = v.evenement_capital ?? 0;
    const depot = evt > 0 ? evt : 0;
    const retrait = evt < 0 ? Math.abs(evt) : 0;
    return {
      date: v.date,
      value: v.vl_part,
      depot,
      depotLabel: depot > 0 ? v.type_evenement : null,
      retrait,
      retraitLabel: retrait > 0 ? v.type_evenement : null,
    };
  });
}
