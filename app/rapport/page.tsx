import { requireMembre } from '@/lib/current-membre';
import { loadEngine, fmtNum, fmtDate, titleCase } from '@/lib/data';
import Shell from '@/components/Shell';
import SendEmailButton from '@/components/SendEmailButton';

export default async function RapportPage() {
  const membre = await requireMembre();
  const { engine, membres } = await loadEngine();
  const t = engine.totals;
  const monCapRow = engine.capTable.find((c) => c.membre_id === membre.id) ?? null;
  const perfClass = (monCapRow?.perf ?? 0) >= 0 ? 'pos' : 'neg';

  return (
    <Shell membre={membre} active="/rapport">
      <div className="card">
        <h2>Mon rapport individuel</h2>
        <p className="card-sub">Arrêté au {fmtDate(t.dateArrete)}</p>
        <div className="grid-kpi" style={{ marginBottom: 16 }}>
          <div className="kpi">
            <div className="label">Capital versé</div>
            <div className="value">{fmtNum(monCapRow?.capital ?? 0, 0)}</div>
            <div className="sub">FCFA</div>
          </div>
          <div className="kpi">
            <div className="label">Parts détenues</div>
            <div className="value">{fmtNum(monCapRow?.parts ?? 0, 2)}</div>
          </div>
          <div className="kpi">
            <div className="label">Valeur position</div>
            <div className="value">{fmtNum(monCapRow?.valeur_position ?? 0, 0)}</div>
            <div className="sub">FCFA</div>
          </div>
          <div className="kpi">
            <div className="label">Performance</div>
            <div className={`value ${perfClass}`}>{fmtNum((monCapRow?.perf ?? 0) * 100, 2)} %</div>
          </div>
        </div>
        <p className="card-sub" style={{ marginBottom: 10 }}>
          Le PDF est généré et joint automatiquement à l&rsquo;email — rien à télécharger ni à joindre
          manuellement.
        </p>
        <SendEmailButton endpoint="/api/send-report-email" label="Recevoir mon rapport par email" />
      </div>

      {membre.is_admin && (
        <div className="card">
          <h2>Envoyer le rapport d&rsquo;un autre membre</h2>
          <p className="card-sub">
            Génère le PDF à la volée et l&rsquo;envoie par email à l&rsquo;adresse enregistrée du membre.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Membre</th><th></th></tr>
              </thead>
              <tbody>
                {membres.map((m) => (
                  <tr key={m.id}>
                    <td>{titleCase(m.nom)}</td>
                    <td>
                      <SendEmailButton
                        endpoint="/api/send-report-email"
                        payload={{ membreId: m.id }}
                        label="Envoyer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
