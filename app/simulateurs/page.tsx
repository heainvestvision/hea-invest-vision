import { requireAdmin } from '@/lib/current-membre';
import { loadEngine } from '@/lib/data';
import Shell from '@/components/Shell';
import SimulateursClient from '@/components/SimulateursClient';

export default async function SimulateursPage() {
  const membre = await requireAdmin();
  const { engine, membres, parametres } = await loadEngine();

  const partsById: Record<string, number> = {};
  engine.capTable.forEach((c) => {
    partsById[c.membre_id] = c.parts;
  });

  return (
    <Shell membre={membre} active="/simulateurs">
      <SimulateursClient
        membres={membres.map((m) => ({ id: m.id, nom: m.nom, date_1er_depot: m.date_1er_depot }))}
        partsById={partsById}
        totalParts={engine.totals.totalParts}
        vlPart={engine.totals.vlPart}
        parametres={parametres}
      />
    </Shell>
  );
}
