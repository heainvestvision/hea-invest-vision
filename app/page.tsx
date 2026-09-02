import { requireMembre } from '@/lib/current-membre';
import { loadEngine, fmtNum, fmtDate, titleCase, buildVlEvolution } from '@/lib/data';
import Shell from '@/components/Shell';
import EvolutionChart from '@/components/EvolutionChart';

export default async function DashboardPage() {
  const membre = await requireMembre();
  const { engine, membres } = await loadEngine();
  const t = engine.totals;
  const perfClass = t.perfGlobale >= 0 ? 'pos' : 'neg';
  const top5 = engine.capTable.slice(0, 5);
  const nomById = new Map(membres.map((m) => [m.id, titleCase(m.nom)]));
  const vlChartData = buildVlEvolution(engine);

  return (
    <Shell membre={membre} active="/">
      <div className="grid-kpi">
        <div className="kpi"><div className="label">Date d&rsquo;arrêté</div><div className="value">{fmtDate(t.dateArrete)}</div></div>
        <div className="kpi"><div className="label">Capital total apporté</div><div className="value">{fmtNum(t.totalCapital, 0)}</div><div className="sub">FCFA</div></div>
        <div className="kpi"><div className="label">Valeur portefeuille</div><div className="value">{fmtNum(t.totalValeur, 0)}</div><div className="sub">FCFA</div></div>
        <div className="kpi"><div className="label">Solde de caisse</div><div className="value">{fmtNum(t.caisseTotal, 0)}</div><div className="sub">FCFA{t.caisseReserve ? ` · dont ${fmtNum(t.caisseReserve, 0)} en réserve` : ''}</div></div>
        <div className="kpi"><div className="label">VL par part</div><div className="value">{fmtNum(t.vlPart, 4)}</div><div className="sub">FCFA / part</div></div>
        <div className="kpi"><div className="label">Plus-value latente</div><div className={`value ${perfClass}`}>{fmtNum(t.plusValue, 0)}</div><div className="sub">FCFA</div></div>
        <div className="kpi"><div className="label">Performance globale</div><div className={`value ${perfClass}`}>{fmtNum(t.perfGlobale * 100, 2)} %</div></div>
      </div>

      {engine.pending.length > 0 && membre.is_admin && (
        <div className="card" style={{ background: 'var(--negative-bg)', borderColor: 'var(--negative)' }}>
          <p style={{ margin: 0, fontSize: 13.5 }}>
            ⏳ {engine.pending.length} dépôt{engine.pending.length > 1 ? 's' : ''} en attente de
            souscription — à traiter dans l&rsquo;onglet Journal.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Évolution de la valeur liquidative</h2>
        <p className="card-sub">VL par part depuis le début du suivi</p>
        <EvolutionChart data={vlChartData} decimals={4} />
      </div>

      <div className="card">
        <h2>Top contributeurs</h2>
        <p className="card-sub">Classement par capital apporté</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Membre</th>
                {membre.is_admin && <th className="num">Capital (FCFA)</th>}
                <th className="num">% détention</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((m, i) => (
                <tr key={m.membre_id}>
                  <td className={i === 0 ? 'rank1' : ''}>{i + 1}</td>
                  <td>{nomById.get(m.membre_id) ?? m.membre_id}</td>
                  {membre.is_admin && <td className="num">{fmtNum(m.capital, 0)}</td>}
                  <td className="num">{fmtNum(m.pct * 100, 2)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
