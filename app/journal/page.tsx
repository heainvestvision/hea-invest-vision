import { requireAdmin } from '@/lib/current-membre';
import { loadEngine, fmtNum, fmtDate, titleCase } from '@/lib/data';
import Shell from '@/components/Shell';
import SouscriptionForm from '@/components/SouscriptionForm';
import RetraitForm from '@/components/RetraitForm';
import TransfertForm from '@/components/TransfertForm';
import SupprimerGroupeButton from '@/components/SupprimerGroupeButton';
import JournalTabs from '@/components/JournalTabs';
import { ajouterDepot, ajouterMouvement, supprimerEcriture } from './actions';

export default async function JournalPage() {
  const membre = await requireAdmin();
  const { engine, membres, parametres } = await loadEngine();
  const nomById = new Map(membres.map((m) => [m.id, titleCase(m.nom)]));
  const nomByIdObj: Record<string, string> = {};
  membres.forEach((m) => {
    nomByIdObj[m.id] = titleCase(m.nom);
  });
  const partsById: Record<string, number> = {};
  const capitalById: Record<string, number> = {};
  engine.capTable.forEach((c) => {
    partsById[c.membre_id] = c.parts;
    capitalById[c.membre_id] = c.capital;
  });
  const rows = [...engine.journal].sort((a, b) => b.date.localeCompare(a.date));

  // Nombre d'écritures par groupe (retrait ou transfert), pour le libellé de
  // confirmation du bouton de suppression groupée.
  const groupeCounts = new Map<string, number>();
  rows.forEach((e) => {
    if (e.groupe_id) groupeCounts.set(e.groupe_id, (groupeCounts.get(e.groupe_id) ?? 0) + 1);
  });

  const tabs = [
    {
      key: 'depot',
      label: 'Dépôt',
      content: (
        <>
          <p className="card-sub">Reste en attente de souscription jusqu&rsquo;à ce que tu traites la file d&rsquo;attente ci-dessous.</p>
          <form action={ajouterDepot} className="entry-form">
            <label>
              Membre
              <select name="membre_id" required>
                {membres.map((m) => (
                  <option key={m.id} value={m.id}>{titleCase(m.nom)}</option>
                ))}
              </select>
            </label>
            <label>Date <input type="date" name="date" required /></label>
            <label>Montant reçu (FCFA) <input type="number" name="montant" min={1} step={1} required /></label>
            <label>
              Moyen
              <select name="moyen">
                <option>Wave</option><option>Tremo</option><option>Espèce</option><option>Virement</option><option>Autre</option>
              </select>
            </label>
            <div className="form-actions">
              <button type="submit" className="primary">Enregistrer (en attente)</button>
            </div>
          </form>
        </>
      ),
    },
    {
      key: 'retrait',
      label: 'Retrait',
      content: (
        <>
          <p className="card-sub">
            La pénalité est calculée automatiquement selon l&rsquo;ancienneté du premier dépôt du
            membre. Le montant net est versé immédiatement, sans file d&rsquo;attente. Si des frais
            réels sont engagés pour l&rsquo;exécuter (virement, déplacement...), indique-les : ils
            sont prélevés sur la pénalité, jamais sur le montant du membre. Ce qui reste de la
            pénalité est automatiquement réparti en nouvelles parts, à parts égales, entre tous les
            autres membres du club. Pense aussi à renseigner un événement capital négatif sur la
            prochaine valorisation, pour que ce retrait apparaisse sur le graphique.
          </p>
          <RetraitForm
            membres={membres.map((m) => ({ id: m.id, nom: m.nom, date_1er_depot: m.date_1er_depot }))}
            partsById={partsById}
            vlPart={engine.totals.vlPart}
            parametres={parametres}
          />
        </>
      ),
    },
    {
      key: 'transfert',
      label: 'Transfert',
      content: (
        <>
          <p className="card-sub">
            Un membre cède tout ou partie de ses parts à un autre — déjà présent dans le club, ou
            nouveau (sa fiche est créée automatiquement). Aucune pénalité, rien ne sort du
            compte-titres : les parts changent juste de propriétaire, avec leur coût
            d&rsquo;acquisition transmis au prorata. Le prix indicatif est purement informatif, il
            n&rsquo;affecte pas la caisse du club.
          </p>
          <TransfertForm
            membres={membres.map((m) => ({ id: m.id, nom: m.nom }))}
            partsById={partsById}
            capitalById={capitalById}
          />
        </>
      ),
    },
    {
      key: 'mouvement',
      label: 'Mouvement interne',
      content: (
        <>
          <p className="card-sub">Frais, réserve, transfert de caisse vers le compte-titres...</p>
          <form action={ajouterMouvement} className="entry-form">
            <label>
              Libellé
              <select name="libelle">
                <option>Transfert vers compte-titres</option>
                <option>Frais de déplacement</option>
                <option>Réserve</option>
              </select>
            </label>
            <label>Date <input type="date" name="date" required /></label>
            <label>Montant (FCFA, négatif si sortie) <input type="number" name="montant" step={1} required /></label>
            <label>
              Moyen
              <select name="moyen"><option>Caisse</option><option>Virement</option></select>
            </label>
            <div className="form-actions">
              <button type="submit" className="primary">Enregistrer le mouvement</button>
            </div>
          </form>
        </>
      ),
    },
  ];

  return (
    <Shell membre={membre} active="/journal">
      <JournalTabs tabs={tabs} />

      {engine.pending.length > 0 && (
        <div className="card">
          <h2>Souscrire les dépôts en attente</h2>
          <p className="card-sub">
            Sélectionne les dépôts à traiter ensemble et la date de souscription commune : leurs
            parts seront attribuées à la VL applicable à cette date. Si des frais ont été engagés
            pour réaliser l&rsquo;opération, indique leur montant total : il sera réparti à parts
            égales entre les dépôts de cette vague. Précise ensuite quelle part correspond à une
            dépense réelle — le reste, non dépensé, part automatiquement en réserve.
          </p>
          <SouscriptionForm
            pending={engine.pending.map((e) => ({
              id: e.id,
              date: e.date,
              membre_id: e.membre_id,
              montant: e.montant,
            }))}
            nomById={nomByIdObj}
          />
        </div>
      )}

      <div className="card">
        <h2>Historique des flux</h2>
        <p className="card-sub">{rows.length} écritures</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Souscription</th><th>Nom</th><th className="num">Montant</th><th>Type</th><th>Moyen</th><th>Vague</th><th className="num">Parts</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{fmtDate(e.date)}</td>
                  <td>{e.en_attente ? <span className="pill neg">en attente</span> : e.date_effective ? fmtDate(e.date_effective) : '—'}</td>
                  <td>{e.membre_id ? nomById.get(e.membre_id) ?? e.membre_id : e.libelle_interne}</td>
                  <td className="num">{fmtNum(e.montant, 0)}</td>
                  <td>{e.type}</td>
                  <td>{e.moyen ?? '—'}</td>
                  <td>{e.vague ?? '—'}</td>
                  <td className="num">{e.parts_calculees !== null ? fmtNum(e.parts_calculees, 2) : '—'}</td>
                  <td>
                    {e.groupe_id ? (
                      <SupprimerGroupeButton
                        groupeId={e.groupe_id}
                        resume={`les ${groupeCounts.get(e.groupe_id) ?? '?'} écritures liées à cette opération (${e.type.toLowerCase()} du ${fmtDate(e.date)})`}
                      />
                    ) : (
                      <form action={supprimerEcriture}>
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" className="ghost" style={{ padding: '4px 9px', fontSize: 11 }}>Supprimer</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
