import { requireMembre } from '@/lib/current-membre';
import { loadEngine, fmtNum, titleCase } from '@/lib/data';
import Shell from '@/components/Shell';

export default async function CapTablePage() {
  const membre = await requireMembre();
  const { engine, membres } = await loadEngine();
  const nomById = new Map(membres.map((m) => [m.id, titleCase(m.nom)]));
  const t = engine.totals;

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
