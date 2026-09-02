import { requireAdmin } from '@/lib/current-membre';
import { loadEngine, fmtNum, fmtDate, titleCase } from '@/lib/data';
import Shell from '@/components/Shell';
import { ajouterDepot, ajouterMouvement, souscrirePending, supprimerEcriture } from './actions';

export default async function JournalPage() {
  const membre = await requireAdmin();
  const { engine, membres } = await loadEngine();
  const nomById = new Map(membres.map((m) => [m.id, titleCase(m.nom)]));
  const rows = [...engine.journal].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Shell membre={membre} active="/journal">
      <div className="card">
        <h2>1. Enregistrer un dépôt</h2>
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
      </div>

      {engine.pending.length > 0 && (
        <div className="card">
          <h2>2. Souscrire les dépôts en attente</h2>
          <p className="card-sub">Sélectionne les dépôts à traiter ensemble et la date de souscription commune.</p>
          <form action={souscrirePending}>
            <div className="table-wrap">
              <table>
                <thead><tr><th></th><th>Date</th><th>Membre</th><th className="num">Montant</th></tr></thead>
                <tbody>
                  {engine.pending.map((e) => (
                    <tr key={e.id}>
                      <td><input type="checkbox" name="ids" value={e.id} defaultChecked /></td>
                      <td>{fmtDate(e.date)}</td>
                      <td>{nomById.get(e.membre_id!) ?? e.membre_id}</td>
                      <td className="num">{fmtNum(e.montant, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions" style={{ marginTop: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600 }}>
                Date de souscription
                <input type="date" name="dateSouscription" required />
              </label>
              <button type="submit" className="primary">Souscrire la sélection</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="section-bar" style={{ margin: '-20px -22px 16px', borderRadius: '14px 14px 0 0' }}>Mouvement interne (frais, réserve, transfert)</h2>
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
      </div>

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
                    <form action={supprimerEcriture}>
                      <input type="hidden" name="id" value={e.id} />
                      <button type="submit" className="ghost" style={{ padding: '4px 9px', fontSize: 11 }}>Supprimer</button>
                    </form>
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
