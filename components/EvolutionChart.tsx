import { fmtNum } from '@/lib/data';

interface EvolutionPoint {
  date: string;
  value: number;
}

// Petit graphique en ligne (SVG pur, sans dépendance externe) pour visualiser
// l'évolution d'une série de valorisations dans le temps — VL par part par
// défaut, mais réutilisable pour toute série { date, value }.
export default function EvolutionChart({
  data,
  decimals = 0,
  suffix = '',
}: {
  data: EvolutionPoint[];
  decimals?: number;
  suffix?: string;
}) {
  if (!data || data.length < 2) {
    return (
      <p className="card-sub" style={{ marginBottom: 0 }}>
        Pas encore assez de valorisations enregistrées pour tracer un graphique
        (au moins deux dates sont nécessaires).
      </p>
    );
  }

  const W = 760;
  const H = 240;
  const padL = 66;
  const padR = 12;
  const padT = 14;
  const padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.abs(max) * 0.1 || 1;
  const yMin = min - span * 0.12;
  const yMax = max + span * 0.12;

  const xPos = (i: number) => padL + (i / (data.length - 1)) * plotW;
  const yPos = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(d.value).toFixed(1)}`)
    .join(' ');
  const baseline = padT + plotH;
  const areaPath = `${linePath} L ${xPos(data.length - 1).toFixed(1)} ${baseline.toFixed(1)} L ${xPos(0).toFixed(1)} ${baseline.toFixed(1)} Z`;

  const gridLevels = 4;
  const gridValues = Array.from({ length: gridLevels + 1 }, (_, i) => yMin + (i / gridLevels) * (yMax - yMin));

  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(data.length / maxLabels));
  const shortDate = (s: string) => {
    const parts = s.split('-');
    return `${parts[2]}/${parts[1]}`;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="Évolution dans le temps"
    >
      {gridValues.map((v, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={yPos(v)}
            y2={yPos(v)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={padL - 8} y={yPos(v) + 3} textAnchor="end" fontSize={9.5} fill="var(--ink-soft)">
            {fmtNum(v, decimals)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="var(--accent)" opacity={0.09} stroke="none" />
      <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={2} />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xPos(i)}
          cy={yPos(d.value)}
          r={i === data.length - 1 ? 3.4 : 2}
          fill="var(--accent)"
        >
          <title>{`${d.date} — ${fmtNum(d.value, decimals)}${suffix}`}</title>
        </circle>
      ))}
      {data.map((d, i) =>
        i % step === 0 || i === data.length - 1 ? (
          <text key={`x-${i}`} x={xPos(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fill="var(--ink-soft)">
            {shortDate(d.date)}
          </text>
        ) : null
      )}
    </svg>
  );
}
