'use client';

import { useState, type ReactNode } from 'react';

interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

// Regroupe les formulaires d'écriture (dépôt, retrait, transfert, mouvement
// interne) sous une seule carte à onglets, pour ne plus les empiler tous les uns
// sous les autres — un seul formulaire visible à la fois. Le contenu de chaque
// onglet vient du Server Component parent (app/journal/page.tsx) : les formulaires
// eux-mêmes ne changent pas, seule leur présentation est regroupée.
export default function JournalTabs({ tabs }: { tabs: TabDef[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? '');

  return (
    <div className="card">
      <div className="op-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`op-tab${active === t.key ? ' active' : ''}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
