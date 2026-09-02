'use client';

import { useState } from 'react';
import { fmtNum, fmtPct, titleCase } from '@/lib/format';
import { computePenalite } from '@/lib/engine';
import type { Parametres } from '@/lib/types';

interface MembreOpt {
  id: string;
  nom: string;
  date_1er_depot: string | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Simulateurs — purs calculs côté client, rien n'est enregistré. Repris du prototype :
// utile pour estimer avant de décider, la saisie réelle se fait dans le Journal.
export default function SimulateursClient({
  membres,
  partsById,
  totalParts,
  vlPart,
  parametres,
}: {
  membres: MembreOpt[];
  partsById: Record<string, number>;
  totalParts: number;
  vlPart: number;
  parametres: Parametres;
}) {
  // ---- Simulation d'entrée ----
  const [candidat, setCandidat] = useState('');
  const [montantEntree, setMontantEntree] = useState('');
  const montant = parseFloat(montantEntree);
  const entreeResult = montant > 0 && (() => {
    const parts = montant / vlPart;
    const nouveauTotal = totalParts + parts;
    const quotePart = nouveauTotal > 0 ? parts / nouveauTotal : 0;
    return { parts, quotePart };
  })();

  // ---- Simulation de sortie ----
  const [membreId, setMembreId] = useState(membres[0]?.id ?? '');
  const [typeRetrait, setTypeRetrait] = useState<'Total' | 'Partiel'>('Total');
  const [montantPartielStr, setMontantPartielStr] = useState('');
  const membre = membres.find((m) => m.id === membreId) ?? null;
  const partsMax = membre ? partsById[membre.id] ?? 0 : 0;
  const montantPartiel = parseFloat(montantPartielStr) || 0;

  const sortieResult = membre && partsMax > 0 && (() => {
    const partsALiquider = typeRetrait === 'Total' ? partsMax : Math.min(partsMax, montantPartiel / vlPart);
    const { taux, years } = computePenalite(todayISO(), membre.date_1er_depot ?? todayISO(), parametres);
    const valeurBrute = partsALiquider * vlPart;
    const penalite = valeurBrute * taux;
    const net = valeurBrute - penalite;
    return { partsALiquider, taux, years, valeurBrute, penalite, net };
  })();

  return (
    <>
      <div className="card">
        <h2>Simulation d&rsquo;entrée</h2>
        <p className="card-sub">Parts attribuées à un nouveau versement, à la VL actuelle — rien n&rsquo;est enregistré</p>
        <div className="entry-form">
          <label>
            Candidat
            <input type="text" value={candidat} onChange={(e) => setCandidat(e.target.value)} placeholder="Nom du candidat" />
          </label>
          <label>
            Montant apporté (FCFA)
            <input type="number" min={0} step={1} value={montantEntree} onChange={(e) => setMontantEntree(e.target.value)} />
          </label>
        </div>
        {entreeResult && (
          <>
            <div className="grid-kpi" style={{ marginTop: 14 }}>
              <div className="kpi">
                <div className="label">VL appliquée</div>
                <div className="value">{fmtNum(vlPart, 4)}</div>
              </div>
              <div className="kpi">
                <div className="label">Parts attribuées</div>
                <div className="value">{fmtNum(entreeResult.parts, 2)}</div>
              </div>
              <div className="kpi">
                <div className="label">Quote-part obtenue</div>
                <div className="value">{fmtPct(entreeResult.quotePart)}</div>
              </div>
            </div>
            <p className="card-sub" style={{ marginTop: 12, marginBottom: 0 }}>
              {candidat.trim() || 'Le candidat'} recevrait {fmtNum(entreeResult.parts, 2)} parts pour {fmtNum(montant, 0)} FCFA,
              à la VL actuelle de {fmtNum(vlPart, 4)} FCFA/part. La valeur des parts déjà détenues par les autres membres n&rsquo;est
              pas affectée.
            </p>
          </>
        )}
      </div>

      <div className="card">
        <h2>Simulation de sortie</h2>
        <p className="card-sub">Montant net à reverser à un membre sortant, pénalité selon l&rsquo;ancienneté — rien n&rsquo;est enregistré</p>
        <div className="entry-form">
          <label>
            Membre sortant
            <select value={membreId} onChange={(e) => setMembreId(e.target.value)}>
              {membres.map((m) => (
                <option key={m.id} value={m.id}>{titleCase(m.nom)}</option>
              ))}
            </select>
          </label>
          <label>
            Type
            <select value={typeRetrait} onChange={(e) => setTypeRetrait(e.target.value as 'Total' | 'Partiel')}>
              <option>Total</option>
              <option>Partiel</option>
            </select>
          </label>
          {typeRetrait === 'Partiel' && (
            <label>
              Montant souhaité (FCFA)
              <input type="number" min={0} step={1} value={montantPartielStr} onChange={(e) => setMontantPartielStr(e.target.value)} />
            </label>
          )}
        </div>
        {sortieResult ? (
          <div className="grid-kpi" style={{ marginTop: 14 }}>
            <div className="kpi">
              <div className="label">Parts liquidées</div>
              <div className="value">{fmtNum(sortieResult.partsALiquider, 2)}</div>
            </div>
            <div className="kpi">
              <div className="label">Valeur brute</div>
              <div className="value">{fmtNum(sortieResult.valeurBrute, 0)}</div>
              <div className="sub">FCFA</div>
            </div>
            <div className="kpi">
              <div className="label">Pénalité ({fmtPct(sortieResult.taux, 0)}, {fmtNum(sortieResult.years, 1)} an{sortieResult.years >= 2 ? 's' : ''})</div>
              <div className="value neg">-{fmtNum(sortieResult.penalite, 0)}</div>
              <div className="sub">FCFA</div>
            </div>
            <div className="kpi">
              <div className="label">Montant net</div>
              <div className="value pos">{fmtNum(sortieResult.net, 0)}</div>
              <div className="sub">FCFA</div>
            </div>
          </div>
        ) : (
          <p className="card-sub" style={{ marginTop: 12, marginBottom: 0 }}>
            Sélectionne un membre détenant des parts pour voir la simulation.
          </p>
        )}
        <p className="card-sub" style={{ marginTop: 14, marginBottom: 0 }}>
          Ce simulateur reste utile pour convertir un montant souhaité en parts avant de te décider.
          Pour enregistrer un vrai retrait, utilise l&rsquo;onglet Journal — il calcule tout seul le
          montant net et signale le maximum disponible.
        </p>
      </div>
    </>
  );
}
