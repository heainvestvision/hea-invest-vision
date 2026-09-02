'use client';

import { useState } from 'react';
import type { MouseEvent } from 'react';
import { fmtNum, fmtDate } from '@/lib/format';

interface EvolutionPoint {
  date: string;
  value: number;
  depot?: number;
  retrait?: number;
}

// Graphique en ligne (SVG pur, sans dépendance externe) pour visualiser l'évolution
// d'une série dans le temps — VL par part par défaut. Les points sont colorés en vert
// quand un dépôt a été souscrit ce jour-là et en rouge quand un retrait a eu lieu, et
// un survol de la souris affiche la date et la valeur exacte au-dessus du graphique.
export default function EvolutionChart({
  data,
  decimals = 0,
  suffix = '',
}: {
  data: EvolutionPoint[];
  decimals?: number;
  suffix?: string;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

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

  const activeIdx = hoverIdx ?? data.length - 1;
  const active = data[activeIdx];

  const handleMove = (evt: MouseEvent<SVGSVGElement>) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const relX = ((evt.clientX - rect.left) / rect.width) * W;
    let closest = 0;
    let closestDist = Infinity;
    data.forEach((_, i) => {
      const d = Math.abs(xPos(i) - relX);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
    });
    setHoverIdx(closest);
  };

  return (
    <div>
      <div className="chart-readout">
        <span className="chart-readout-date">{fmtDate(active.date)}</span>
        <span className="chart-readout-value">
          {fmtNum(active.value, decimals)}
          {suffix}
        </span>
        {!!active.depot && (
          <span className="chart-readout-tag pos">Dépôt +{fmtNum(active.depot, 0)} FCFA</span>
        )}
        {!!active.retrait && (
          <span className="chart-readout-tag neg">Retrait -{fmtNum(active.retrait, 0)} FCFA</span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: 'crosshair' }}
        role="img"
        aria-label="Évolution dans le temps"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
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

        {hoverIdx !== null && (
          <line
            x1={xPos(hoverIdx)}
            x2={xPos(hoverIdx)}
            y1={padT}
            y2={baseline}
            stroke="var(--accent-ink)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {data.map((d, i) => {
          const isActive = i === activeIdx;
          let color = 'var(--accent)';
          let r = i === data.length - 1 ? 3.4 : 2;
          if (d.retrait) {
            color = 'var(--negative)';
            r = 3.4;
          } else if (d.depot) {
            color = 'var(--positive)';
            r = 3.4;
          }
          return (
            <circle
              key={i}
              cx={xPos(i)}
              cy={yPos(d.value)}
              r={isActive ? r + 1.2 : r}
              fill={color}
              stroke={isActive ? 'var(--surface)' : 'none'}
              strokeWidth={isActive ? 1.5 : 0}
            />
          );
        })}

        {data.map((d, i) =>
          i % step === 0 || i === data.length - 1 ? (
            <text key={`x-${i}`} x={xPos(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fill="var(--ink-soft)">
              {shortDate(d.date)}
            </text>
          ) : null
        )}
      </svg>
      <div className="chart-legend">
        <span>
          <i className="dot" style={{ background: 'var(--positive)' }} /> Dépôt souscrit
        </span>
        <span>
          <i className="dot" style={{ background: 'var(--negative)' }} /> Retrait
        </span>
      </div>
    </div>
  );
}
