import { requireMembre } from '@/lib/current-membre';
import { loadEngine, fmtNum, titleCase } from '@/lib/data';
import { computeMemberEvolution } from '@/lib/engine';
import Shell from '@/components/Shell';
import EvolutionChart from '@/components/EvolutionChart';

export default async function CapTablePage() {
  const membre = await requireMembre();
  const { engine, membres } = await loadEngine();
  const nomById = new Map(membres.map((m) => [m.id, titleCase(m.nom)]));
  const t = engine.totals;

  // Un membre normal ne voit plus la table de tous les membres : uniquement sa
  // propre position, en détail, et son évolution depuis son entrée dans le club.
  // Seul l'admin garde la vue complète (voir /parametres et la RLS Supabase pour
  // le reste de cette séparation) — voir la discussion du 8/9/2026 avec Ridwan.
  if (!membre.is_admin) {
    const maLigne = engine.capTable.find((c) => c.membre_id === membre.id);
    const evolution = computeMemberEvolution(engine, membre.id).map((p) => ({
      date: p.date,
      value: p.valeur,
    }));

    return (
      <Shell membre={membre} active="/captable">
        <div className="card">
          <h2>Ma position</h2>
          <p className="card-sub">Ta situation dans le club, calculée depuis le Journal et la dernière VL.</p>
          {!maLigne ? (
            <p className="card-sub" style={{ marginBottom: 0 }}>
              Tu n&rsquo;as pas encore de parts enregistrées.
            </p>
          ) : (
            <div className="calc-box">
              <div className="item">
                <div className="label">Parts détenues</div>
                <div className="value">{fmtNum(maLigne.parts, 2)}</div>
              </div>
              <div className="item">
                <div className="label">% détention du club</div>
                <div className="value">{fmtNum(maLigne.pct * 100, 2)} %</div>
              </div>
              <div className="item">
                <div className="label">Capital apporté</div>
                <div className="value">{fmtNum(maLigne.capital, 0)} FCFA</div>
              </div>
              <div className="item">
                <div className="label">Valeur de ta position</div>
                <div className="value">{fmtNum(maLigne.valeur_position, 0)} FCFA</div>
              </div>
              <div className="item">
                <div className="label">Gain / Perte</div>
                <div className="value">
                  <span className={`pill ${maLigne.gain >= 0 ? 'pos' : 'neg'}`}>
                    {maLigne.gain >= 0 ? '+' : ''}
                    {fmtNum(maLigne.gain, 0)} FCFA
                  </span>
                </div>
              </div>
              <div className="item">
                <div className="label">Performance</div>
                <div className="value">{fmtNum(maLigne.perf * 100, 2)} %</div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Évolution de ta position</h2>
          <p className="card-sub">Valeur de ta position (FCFA) à chaque valorisation depuis ton entrée dans le club.</p>
          <EvolutionChart data={evolution} decimals={0} suffix=" FCFA" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell membre={membre} active="/captable">
      <div className="card">
        <h2>Table de capitalisation</h2>
        <p className="card-sub">Calculée automatiquement depuis le Journal et la dernière VL</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Membre</th>
                <th className="num">Capital (FCFA)</th>
                <th className="num">Parts</th>
                <th className="num">% détention</th>
                <th className="num">Valeur position</th>
                <th className="num">Gain / Perte</th>
                <th className="num">Performance</th>
              </tr>
            </thead>
            <tbody>
              {engine.capTable.map((m) => (
                <tr key={m.membre_id}>
                  <td>{nomById.get(m.membre_id) ?? m.membre_id}</td>
                  <td className="num">{fmtNum(m.capital, 0)}</td>
                  <td className="num">{fmtNum(m.parts, 2)}</td>
                  <td className="num">{fmtNum(m.pct * 100, 2)} %</td>
                  <td className="num">{fmtNum(m.valeur_position, 0)}</td>
                  <td className="num">
                    <span className={`pill ${m.gain >= 0 ? 'pos' : 'neg'}`}>
                      {m.gain >= 0 ? '+' : ''}
                      {fmtNum(m.gain, 0)}
                    </span>
                  </td>
                  <td className="num">{fmtNum(m.perf * 100, 2)} %</td>
                </tr>
              ))}
              <tr className="total">
                <td>TOTAL</td>
                <td className="num">{fmtNum(t.totalCapital, 0)}</td>
                <td className="num">{fmtNum(t.totalParts, 2)}</td>
                <td className="num">100,00 %</td>
                <td className="num">{fmtNum(t.totalValeur, 0)}</td>
                <td className="num">{fmtNum(t.plusValue, 0)}</td>
                <td className="num">{fmtNum(t.perfGlobale * 100, 2)} %</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
