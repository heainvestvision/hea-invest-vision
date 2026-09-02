import { requireAdmin } from '@/lib/current-membre';
import { loadEngine, fmtNum, fmtDate, titleCase } from '@/lib/data';
import Shell from '@/components/Shell';
import SendEmailButton from '@/components/SendEmailButton';
import type { JournalEnrichi } from '@/lib/engine';

export default async function AvisPage() {
  const membre = await requireAdmin();
  const { engine, membres } = await loadEngine();
  const nomById = new Map(membres.map((m) => [m.id, titleCase(m.nom)]));

  const souscrits = engine.journal.filter(
    (e) => e.type === 'Dépôt' && !e.en_attente && e.date_effective && e.parts_calculees !== null
  );

  // Regroupe par date de souscription (= la vague), la plus récente en premier.
  const parVague = new Map<string, JournalEnrichi[]>();
  for (const e of souscrits) {
    const key = e.date_effective as string;
    if (!parVague.has(key)) parVague.set(key, []);
    parVague.get(key)!.push(e);
  }
  const vagues = [...parVague.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <Shell membre={membre} active="/avis">
      {engine.pending.length > 0 && (
        <div className="card" style={{ background: 'var(--negative-bg)', borderColor: 'var(--negative)' }}>
          <p style={{ margin: 0, fontSize: 13.5 }}>
            ⏳ {engine.pending.length} dépôt{engine.pending.length > 1 ? 's' : ''} en attente de
            souscription — à traiter dans l&rsquo;onglet Journal avant de pouvoir générer un avis.
          </p>
        </div>
      )}

      {vagues.map(([date, entries]) => (
        <div className="card" key={date}>
          <h2>Vague du {fmtDate(date)}</h2>
          <p className="card-sub">
            {entries.length} membre{entries.length > 1 ? 's' : ''} — le PDF est généré et joint
            automatiquement à l&rsquo;email envoyé.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Membre</th>
                  <th className="num">Montant</th>
                  <th className="num">Parts attribuées</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{nomById.get(e.membre_id!) ?? e.membre_id}</td>
                    <td className="num">{fmtNum(e.montant, 0)}</td>
                    <td className="num">{fmtNum(e.parts_calculees!, 2)}</td>
                    <td>
                      <SendEmailButton
                        endpoint="/api/send-avis-email"
                        payload={{ entryId: e.id }}
                        label="Envoyer l'avis"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {vagues.length === 0 && engine.pending.length === 0 && (
        <div className="card">
          <p className="card-sub">Aucune souscription enregistrée pour l&rsquo;instant.</p>
        </div>
      )}
    </Shell>
  );
}
