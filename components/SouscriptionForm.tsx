'use client';

import { useState } from 'react';
import { fmtDate, fmtNum } from '@/lib/format';
import { souscrirePending } from '@/app/journal/actions';

interface PendingRow {
  id: string;
  date: string;
  membre_id: string | null;
  montant: number;
}

// Étape 2 du Journal : souscrire les dépôts en attente à une date commune, avec la
// répartition optionnelle des frais engagés — répliqué à l'identique du prototype
// (voir la carte "Valorisations"/"Journal" du prototype avant déploiement) :
// le total saisi est réparti à parts égales entre les dépôts cochés, la part "dépense
// réelle" crée une écriture de mouvement interne, le reste part en réserve.
export default function SouscriptionForm({
  pending,
  nomById,
}: {
  pending: PendingRow[];
  nomById: Record<string, string>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(pending.map((e) => e.id)));
  const [fraisTotal, setFraisTotal] = useState(0);
  const [fraisReel, setFraisReel] = useState(0);
  const [fraisLibelle, setFraisLibelle] = useState('Frais de déplacement');

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === pending.length ? new Set() : new Set(pending.map((e) => e.id))));
  };

  const nbSelected = selected.size;
  const showFrais = fraisTotal > 0;
  const parDepot = nbSelected > 0 ? fraisTotal / nbSelected : 0;
  const reserve = Math.max(0, fraisTotal - fraisReel);
  const fraisError = fraisReel > fraisTotal;

  return (
    <form action={souscrirePending}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.size === pending.length} onChange={toggleAll} /></th>
              <th>Date</th>
              <th>Membre</th>
              <th className="num">Montant</th>
            </tr>
          </thead>
          <tbody>
            {pending.map((e) => (
              <tr key={e.id}>
                <td>
                  <input
                    type="checkbox"
                    name="ids"
                    value={e.id}
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                  />
                </td>
                <td>{fmtDate(e.date)}</td>
                <td>{e.membre_id ? nomById[e.membre_id] ?? e.membre_id : '—'}</td>
                <td className="num">{fmtNum(e.montant, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="entry-form" style={{ marginTop: 12 }}>
        <label>
          Date de souscription
          <input type="date" name="dateSouscription" required />
        </label>
        <label>
          Frais total engagés (FCFA, optionnel)
          <input
            type="number"
            name="fraisTotal"
            min={0}
            step={1}
            defaultValue={0}
            onChange={(e) => setFraisTotal(Number(e.target.value) || 0)}
          />
        </label>

        {showFrais && (
          <>
            <label>
              Dont dépense réelle (FCFA)
              <input
                type="number"
                name="fraisReel"
                min={0}
                step={1}
                defaultValue={0}
                onChange={(e) => setFraisReel(Number(e.target.value) || 0)}
              />
            </label>
            <label>
              Libellé de la dépense
              <select name="fraisLibelle" value={fraisLibelle} onChange={(e) => setFraisLibelle(e.target.value)}>
                <option>Frais de déplacement</option>
                <option value="__autre__">Autre…</option>
              </select>
            </label>
            {fraisLibelle === '__autre__' && (
              <label>
                Libellé personnalisé
                <input type="text" name="fraisLibelleAutre" placeholder="Ex : Frais bancaires" />
              </label>
            )}
          </>
        )}

        {showFrais && (
          <div style={{ gridColumn: '1/-1' }}>
            {fraisError ? (
              <div className="calc-box err">
                <div className="item">
                  <div className="label">Dépense réelle</div>
                  <div className="value">ne peut pas dépasser les frais totaux</div>
                </div>
              </div>
            ) : (
              <div className="calc-box">
                <div className="item">
                  <div className="label">Retenu par dépôt ({nbSelected})</div>
                  <div className="value">{fmtNum(parDepot, 0)} FCFA</div>
                </div>
                <div className="item">
                  <div className="label">Dépense réelle</div>
                  <div className="value">{fmtNum(fraisReel, 0)} FCFA</div>
                </div>
                <div className="item">
                  <div className="label">Vers la réserve</div>
                  <div className="value">{fmtNum(reserve, 0)} FCFA</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={nbSelected === 0 || fraisError}>
            Souscrire la sélection
          </button>
        </div>
      </div>
    </form>
  );
}
