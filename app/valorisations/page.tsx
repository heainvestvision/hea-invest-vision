import { requireAdmin } from '@/lib/current-membre';
import { loadEngine, fmtNum, fmtDate } from '@/lib/data';
import Shell from '@/components/Shell';
import EvolutionChart from '@/components/EvolutionChart';
import { ajouterValorisation, supprimerValorisation } from './actions';

export default async function ValorisationsPage() {
  const membre = await requireAdmin();
  const { engine } = await loadEngine();

  const chartData = [...engine.valorisations]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((v) => ({ date: v.date, value: v.vl_part }));

  const rows = [...engine.valorisations].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Shell membre={membre} active="/valorisations">
      <div className="card">
        <h2>Évolution de la valeur liquidative</h2>
        <p className="card-sub">VL par part recalculée à chaque valorisation enregistrée ci-dessous</p>
        <EvolutionChart data={chartData} decimals={4} />
      </div>

      <div className="card">
        <h2>Enregistrer une valorisation</h2>
        <p className="card-sub">
          C&rsquo;est cette saisie régulière de la valeur du portefeuille qui détermine la VL par
          part (et donc les parts attribuées aux prochaines souscriptions). Une seule valorisation
          par date.
        </p>
        <form action={ajouterValorisation} className="entry-form">
          <label>
            Date
            <input type="date" name="date" required />
          </label>
          <label>
            Valeur du portefeuille (FCFA)
            <input type="number" name="valeur_portefeuille" min={0} step="0.01" required />
          </label>
          <label>
            Événement capital (FCFA, optionnel)
            <input type="number" name="evenement_capital" step="0.01" />
          </label>
          <label>
            Type d&rsquo;événement (optionnel)
            <input type="text" name="type_evenement" placeholder="ex. 2e déploiement" />
          </label>
          <div className="form-actions">
            <button type="submit" className="primary">Enregistrer la valorisation</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Historique des valorisations</h2>
        <p className="card-sub">{rows.length} valorisation{rows.length > 1 ? 's' : ''}</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Valeur portefeuille</th>
                <th className="num">Parts en circulation</th>
                <th className="num">VL / part</th>
                <th>Événement</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>{fmtDate(v.date)}</td>
                  <td className="num">{fmtNum(v.valeur_portefeuille, 0)}</td>
                  <td className="num">{fmtNum(v.parts_circulation, 2)}</td>
                  <td className="num">{fmtNum(v.vl_part, 4)}</td>
                  <td>
                    {v.type_evenement ?? '—'}
                    {v.evenement_capital ? ` (${fmtNum(v.evenement_capital, 0)} FCFA)` : ''}
                  </td>
                  <td>
                    <form action={supprimerValorisation}>
                      <input type="hidden" name="id" value={v.id} />
                      <button type="submit" className="ghost" style={{ padding: '4px 9px', fontSize: 11 }}>
                        Supprimer
                      </button>
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
