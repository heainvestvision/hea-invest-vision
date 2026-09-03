'use client';

import { envoyerRapportsMaintenant } from '@/app/historique/actions';

// Bouton admin qui déclenche un vrai envoi immédiat des rapports individuels à tous
// les membres ayant un email — donc une confirmation avant de partir, contrairement
// aux autres boutons de l'app (supprimer une écriture...), vu l'ampleur de l'action
// (potentiellement tous les membres reçoivent un email d'un coup, tout de suite).
export default function EnvoyerRapportsButton() {
  return (
    <form
      action={envoyerRapportsMaintenant}
      onSubmit={(e) => {
        const ok = window.confirm(
          "Envoyer maintenant le rapport individuel par email à tous les membres ayant une adresse enregistrée ? Cette action envoie de vrais emails immédiatement."
        );
        if (!ok) e.preventDefault();
      }}
    >
      <button type="submit" className="primary">
        Envoyer les rapports individuels maintenant
      </button>
    </form>
  );
}
