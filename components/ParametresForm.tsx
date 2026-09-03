'use client';

import { useState } from 'react';
import { fmtNum } from '@/lib/format';
import { mettreAJourParametres } from '@/app/parametres/actions';
import type { Parametres } from '@/lib/types';

function pct(n: number): string {
  return (n * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

// Formulaire des paramètres du club — un seul champ (parts initiales) déclenche une
// confirmation avant envoi, parce que c'est le seul champ modifiable ici qui a un
// effet global rétroactif (même s'il reste sans risque réel, voir actions.ts). Le
// capital fondateur n'a délibérément aucun champ : il n'apparaît qu'en lecture seule
// au-dessus du formulaire.
export default function ParametresForm({ parametres }: { parametres: Parametres }) {
  const [partsInitiales, setPartsInitiales] = useState(String(parametres.parts_initiales));

  const partsChangees = (parseFloat(partsInitiales) || 0) !== parametres.parts_initiales;

  return (
    <form
      action={mettreAJourParametres}
      className="entry-form"
      onSubmit={(e) => {
        if (partsChangees) {
          const ancien = parametres.parts_initiales.toLocaleString('fr-FR');
          const nouveau = (parseFloat(partsInitiales) || 0).toLocaleString('fr-FR');
          const ok = window.confirm(
            `Tu changes le nombre de parts initiales de ${ancien} à ${nouveau}. Ça ne change ni le ` +
              `pourcentage détenu ni la valeur en FCFA de personne — juste le nombre de parts affiché ` +
              `pour tout le monde, comme un changement d'unité (un "split"). Mais les documents déjà ` +
              `envoyés (avis de souscription, rapports) afficheront un nombre de parts différent de ` +
              `celui affiché maintenant dans l'app. Continuer ?`
          );
          if (!ok) e.preventDefault();
        }
      }}
    >
      <h2 className="section-bar" style={{ gridColumn: '1/-1', marginTop: 0 }}>
        Fondation
      </h2>
      <div style={{ gridColumn: '1/-1' }} className="calc-box">
        <div className="item">
          <div className="label">Capital fondateur (verrouillé)</div>
          <div className="value">{fmtNum(parametres.capital_fondateur, 0)} FCFA</div>
        </div>
      </div>
      <p className="card-sub" style={{ gridColumn: '1/-1', margin: '2px 0 0' }}>
        Non modifiable : c&rsquo;est ce que les fondateurs ont réellement investi à la création, et ce
        qui a déterminé les parts de chacun selon sa contribution.
      </p>
      <label>
        Parts initiales
        <input
          type="number"
          name="parts_initiales"
          min={0}
          step="any"
          value={partsInitiales}
          onChange={(e) => setPartsInitiales(e.target.value)}
          required
        />
      </label>

      <h2 className="section-bar" style={{ gridColumn: '1/-1' }}>
        Pénalités de retrait par ancienneté
      </h2>
      <label>
        Moins d&rsquo;1 an (%)
        <input type="number" name="penalite_moins_1an_pct" min={0} step="0.01" defaultValue={pct(parametres.penalite_moins_1an)} />
      </label>
      <label>
        1 à 2 ans (%)
        <input type="number" name="penalite_1a_2ans_pct" min={0} step="0.01" defaultValue={pct(parametres.penalite_1a_2ans)} />
      </label>
      <label>
        2 à 3 ans (%)
        <input type="number" name="penalite_2a_3ans_pct" min={0} step="0.01" defaultValue={pct(parametres.penalite_2a_3ans)} />
      </label>
      <label>
        Plus de 3 ans (%)
        <input type="number" name="penalite_plus_3ans_pct" min={0} step="0.01" defaultValue={pct(parametres.penalite_plus_3ans)} />
      </label>

      <h2 className="section-bar" style={{ gridColumn: '1/-1' }}>
        Autres paramètres
      </h2>
      <p className="card-sub" style={{ gridColumn: '1/-1', margin: '0 0 4px' }}>
        Pas encore utilisés dans les calculs de l&rsquo;app — les modifier ne change rien pour
        l&rsquo;instant, ils seront branchés à une logique plus tard.
      </p>
      <label>
        VL implicite
        <input type="number" name="vl_implicite" min={0} step="0.0001" defaultValue={parametres.vl_implicite} />
      </label>
      <label>
        Frais d&rsquo;entrée (%)
        <input type="number" name="frais_entree_pct" min={0} step="0.01" defaultValue={pct(parametres.frais_entree)} />
      </label>
      <label>
        Préavis (jours)
        <input type="number" name="preavis_jours" min={0} step="1" defaultValue={parametres.preavis_jours} />
      </label>

      <div className="form-actions">
        <button type="submit" className="primary">
          Enregistrer les paramètres
        </button>
      </div>
    </form>
  );
}
