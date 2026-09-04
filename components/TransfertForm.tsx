'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { fmtNum, titleCase } from '@/lib/format';
import { ajouterTransfert } from '@/app/journal/actions';

interface MembreOpt {
  id: string;
  nom: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Formulaire de transfert de titre : un membre (le cédant) cède tout ou partie de
// ses parts à un autre membre — déjà présent dans le club, ou nouveau (le
// formulaire crée alors sa fiche) — sans passer par un retrait (pas de pénalité,
// rien ne sort du compte-titres) ni par un dépôt (pas de nouvelle capital qui
// entre). Le coût d'acquisition des parts transférées (base du calcul de la
// plus-value de chacun) est transmis au prorata du coût moyen par part du cédant —
// voir ajouterTransfert dans app/journal/actions.ts. Le prix indicatif payé par le
// receveur au cédant, lui, n'est enregistré qu'à titre informatif dans
// l'historique : cet argent passe entre eux, pas par la caisse du club.
export default function TransfertForm({
  membres,
  partsById,
  capitalById,
}: {
  membres: MembreOpt[];
  partsById: Record<string, number>;
  capitalById: Record<string, number>;
}) {
  const [cedantId, setCedantId] = useState(membres[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [partsWanted, setPartsWanted] = useState('');
  const [modeReceveur, setModeReceveur] = useState<'existant' | 'nouveau'>('existant');
  const [receveurId, setReceveurId] = useState('');
  const [nouveauNom, setNouveauNom] = useState('');
  const [nouveauPrenom, setNouveauPrenom] = useState('');
  const [nouveauEmail, setNouveauEmail] = useState('');
  const [prixIndicatifStr, setPrixIndicatifStr] = useState('');

  const partsMax = partsById[cedantId] ?? 0;
  const capitalCedant = capitalById[cedantId] ?? 0;
  const parts = parseFloat(partsWanted);
  const prixIndicatif = prixIndicatifStr ? parseFloat(prixIndicatifStr) || 0 : 0;
  const autresMembres = membres.filter((m) => m.id !== cedantId);

  let preview: ReactNode = null;
  let disabled = true;

  if (!(partsMax > 0)) {
    preview = (
      <div className="calc-box err">
        <div className="item">
          <div className="label">Parts détenues par le cédant</div>
          <div className="value">0,00</div>
        </div>
        <div className="item">
          <div className="label">Transfert</div>
          <div className="value">impossible — aucune part</div>
        </div>
      </div>
    );
  } else if (!parts || parts <= 0) {
    preview = (
      <div className="calc-box">
        <div className="item">
          <div className="label">Parts détenues par le cédant</div>
          <div className="value">{fmtNum(partsMax, 2)}</div>
        </div>
      </div>
    );
  } else if (parts > partsMax + 1e-9) {
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
      </div>
    );
  } else if (modeReceveur === 'existant' && !receveurId) {
    preview = (
      <div className="calc-box err">
        <div className="item">
          <div className="label">Receveur</div>
          <div className="value">à sélectionner</div>
        </div>
      </div>
    );
  } else if (modeReceveur === 'nouveau' && !nouveauNom.trim()) {
    preview = (
      <div className="calc-box err">
        <div className="item">
          <div className="label">Nouveau membre</div>
          <div className="value">nom requis</div>
        </div>
      </div>
    );
  } else {
    const coutParPart = partsMax > 0 ? capitalCedant / partsMax : 0;
    const coutTransfere = Math.round(parts * coutParPart);
    disabled = false;
    preview = (
      <div className="calc-box">
        <div className="item">
          <div className="label">Coût moyen par part du cédant</div>
          <div className="value">{fmtNum(coutParPart, 2)}</div>
        </div>
        <div className="item">
          <div className="label">Coût transféré (base de la plus-value)</div>
          <div className="value">{fmtNum(coutTransfere, 0)} FCFA</div>
        </div>
        <div className="item">
          <div className="label">Parts du cédant après transfert</div>
          <div className="value">{fmtNum(partsMax - parts, 2)}</div>
        </div>
        {prixIndicatif > 0 && (
          <div className="item">
            <div className="label">Prix indicatif (non comptabilisé)</div>
            <div className="value">{fmtNum(prixIndicatif, 0)} FCFA</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={ajouterTransfert} className="entry-form">
      <label>
        Cédant
        <select
          name="cedant_id"
          value={cedantId}
          onChange={(e) => {
            setCedantId(e.target.value);
            setReceveurId('');
          }}
          required
        >
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
        Parts à transférer
        <input
          type="number"
          name="parts"
          min={0}
          step="any"
          value={partsWanted}
          onChange={(e) => setPartsWanted(e.target.value)}
        />
      </label>

      <label>
        Receveur
        <select value={modeReceveur} onChange={(e) => setModeReceveur(e.target.value as 'existant' | 'nouveau')}>
          <option value="existant">Membre déjà dans le club</option>
          <option value="nouveau">Nouveau membre (pas encore dans le club)</option>
        </select>
      </label>
      <input type="hidden" name="modeReceveur" value={modeReceveur} />

      {modeReceveur === 'existant' ? (
        <label>
          Membre receveur
          <select name="receveur_id" value={receveurId} onChange={(e) => setReceveurId(e.target.value)} required>
            <option value="">— choisir —</option>
            {autresMembres.map((m) => (
              <option key={m.id} value={m.id}>
                {titleCase(m.nom)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label>
            Nom du nouveau membre
            <input
              type="text"
              name="nouveauNom"
              value={nouveauNom}
              onChange={(e) => setNouveauNom(e.target.value)}
              required
            />
          </label>
          <label>
            Prénom (optionnel)
            <input type="text" name="nouveauPrenom" value={nouveauPrenom} onChange={(e) => setNouveauPrenom(e.target.value)} />
          </label>
          <label>
            Email (optionnel)
            <input type="email" name="nouveauEmail" value={nouveauEmail} onChange={(e) => setNouveauEmail(e.target.value)} />
          </label>
        </>
      )}

      <label>
        Prix indicatif (FCFA, optionnel — non comptabilisé)
        <input
          type="number"
          name="prixIndicatif"
          min={0}
          step={1}
          value={prixIndicatifStr}
          onChange={(e) => setPrixIndicatifStr(e.target.value)}
          placeholder="0"
        />
      </label>

      <div style={{ gridColumn: '1/-1' }}>{preview}</div>
      <div className="form-actions">
        <button type="submit" className="primary" disabled={disabled}>
          Enregistrer le transfert
        </button>
      </div>
    </form>
  );
}
