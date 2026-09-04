'use client';

import { supprimerGroupe } from '@/app/journal/actions';

// Bouton de suppression groupée : supprime en une seule action toutes les
// écritures liées à une même opération (retrait ou transfert), pour ne jamais
// laisser les comptes déséquilibrés entre deux suppressions individuelles.
export default function SupprimerGroupeButton({ groupeId, resume }: { groupeId: string; resume: string }) {
  return (
    <form
      action={supprimerGroupe}
      onSubmit={(e) => {
        const ok = window.confirm(`Ceci va supprimer ${resume}. Continuer ?`);
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="groupe_id" value={groupeId} />
      <button type="submit" className="ghost" style={{ padding: '4px 9px', fontSize: 11 }}>
        Supprimer le groupe
      </button>
    </form>
  );
}
