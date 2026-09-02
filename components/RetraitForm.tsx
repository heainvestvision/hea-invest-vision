'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { fmtNum, fmtPct, titleCase } from '@/lib/format';
import { computePenalite } from '@/lib/engine';
import { ajouterRetrait } from '@/app/journal/actions';
import type { Parametres } from '@/lib/types';

interface MembreOpt {
  id: string;
  nom: string;
  date_1er_depot: string | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Formulaire de retrait — absent de l'app déployée jusqu'ici, réintroduit à l'identique
// du prototype : la pénalité est calculée en direct selon l'ancienneté du premier dépôt
// du membre (mêmes 4 paliers que computePenalite dans lib/engine.ts, réutilisée ici
// telle quelle côté client puisqu'elle est pure — aucune dépendance serveur).
export default function RetraitForm({
  membres,
  partsById,
  vlPart,
  parametres,
}: {
  membres: MembreOpt[];
  partsById: Record<string, number>;
  vlPart: number;
  parametres: Parametres;
}) {
  const [membreId, setMembreId] = useState(membres[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [partsWanted, setPartsWanted] = useState('');

  const membre = membres.find((m) => m.id === membreId) ?? null;
  const partsMax = membre ? partsById[membre.id] ?? 0 : 0;
  const parts = parseFloat(partsWanted);

  let preview: ReactNode = null;
  let disabled = true;

  if (!membre || !(partsMax > 0)) {
    preview = (
      <div className="calc-box err">
        <div className="item">
          <div className="label">Parts détenues</div>
          <div className="value">0,00</div>
        </div>
        <div className="item">
          <div className="label">Retrait</div>
          <div className="value">impossible — aucune part</div>
        </div>
      </div>
    );
  } else {
    const { taux, years } = computePenalite(date || todayISO(), membre.date_1er_depot ?? date, parametres);

    if (!parts || parts <= 0) {
      preview = (
        <>
          <div className="calc-box">
            <div className="item">
              <div className="label">Parts détenues</div>
              <div className="value">{fmtNum(partsMax, 2)}</div>
            </div>
            <div className="item">
              <div className="label">VL actuelle</div>
              <div className="value">{fmtNum(vlPart, 4)}</div>
            </div>
            <div className="item">
              <div className="label">Pénalité ({fmtNum(years, 1)} an{years >= 2 ? 's' : ''} d&rsquo;ancienneté)</div>
              <div className="value">{fmtPct(taux, 0)}</div>
            </div>
          </div>
          <button
            type="button"
            className="ghost"
            style={{ marginTop: 10 }}
            onClick={() => setPartsWanted(String(partsMax))}
          >
            Retirer la totalité ({fmtNum(partsMax, 2)} parts)
          </button>
        </>
      );
    } else if (parts > partsMax + 1e-9) {
      const valeurBruteMax = partsMax * vlPart;
      const netMax = valeurBruteMax - valeurBruteMax * taux;
      preview = (
        <div className="calc-box err">
          <div className="item">
            <div className="label">Demande impossible</div>
            <div className="value">{fmtNum(parts, 2)} parts</div>
          </div>
          <div className="item">
            <div className="label">Maximum disponible</div>
            <div className="value">{fmtNum(partsMax, 2)} parts</div>
          </div>
          <div className="item">
            <div className="label">Soit au maximum</div>
            <div className="value">{fmtNum(Math.round(netMax), 0)} FCFA</div>
          </div>
        </div>
      );
    } else {
      const valeurBrute = parts * vlPart;
      const penalite = valeurBrute * taux;
      const net = valeurBrute - penalite;
      disabled = false;
      preview = (
        <div className="calc-box">
          <div className="item">
            <div className="label">VL appliquée</div>
            <div className="value">{fmtNum(vlPart, 4)}</div>
          </div>
          <div className="item">
            <div className="label">Valeur brute</div>
            <div className="value">{fmtNum(valeurBrute, 0)}</div>
          </div>
          <div className="item">
            <div className="label">Pénalité ({fmtPct(taux, 0)}, {fmtNum(years, 1)} an{years >= 2 ? 's' : ''})</div>
            <div className="value neg">-{fmtNum(penalite, 0)}</div>
          </div>
          <div className="item">
            <div className="label">Montant net à verser</div>
            <div className="value pos">{fmtNum(net, 0)} FCFA</div>
          </div>
        </div>
      );
    }
  }

  return (
    <form action={ajouterRetrait} className="entry-form">
      <label>
        Membre
        <select name="membre_id" value={membreId} onChange={(e) => setMembreId(e.target.value)} required>
          {membres.map((m) => (
            <option key={m.id} value={m.id}>
              {titleCase(m.nom)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date
        <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </label>
      <label>
        Parts à retirer
        <input
          type="number"
          name="parts"
          min={0}
          step="any"
          value={partsWanted}
          onChange={(e) => setPartsWanted(e.target.value)}
        />
      </label>
      <div style={{ gridColumn: '1/-1' }}>{preview}</div>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={disabled}>
          Enregistrer le retrait
        </button>
      </div>
    </form>
  );
}
