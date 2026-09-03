import { requireAdmin } from '@/lib/current-membre';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, titleCase } from '@/lib/data';
import Shell from '@/components/Shell';
import EnvoyerRapportsButton from '@/components/EnvoyerRapportsButton';
import type { HistoriqueEntry } from '@/lib/types';

// Journal d'activité admin : qui a fait quoi et quand (ajout d'un dépôt, suppression
// d'une écriture, souscription, envoi d'email...). Alimenté par logHistorique() dans
// les différentes actions serveur, et par la route cron d'envoi mensuel automatique
// (app/api/cron/monthly-reports/route.ts — actor_id null = action automatique, pas
// faite par un admin).
export default async function HistoriquePage() {
  const membre = await requireAdmin();
  const supabase = await createClient();

  const [{ data: entries, error: eHist }, { data: membres, error: eMembres }] = await Promise.all([
    supabase.from('historique').select('*').order('ts', { ascending: false }).limit(200),
    supabase.from('membres').select('id, nom, auth_user_id'),
  ]);
  if (eHist) throw eHist;
  if (eMembres) throw eMembres;

  const nomByAuthId = new Map(
    (membres ?? []).map((m: { auth_user_id: string | null; nom: string }) => [m.auth_user_id, titleCase(m.nom)])
  );

  const rows = (entries ?? []) as HistoriqueEntry[];

  return (
    <Shell membre={membre} active="/historique">
      <div className="card">
        <h2>Envoi des rapports individuels</h2>
        <p className="card-sub">
          Envoyé automatiquement à tous les membres le dernier jour de chaque mois (voir plus bas
          pour vérifier que ça s&rsquo;est bien passé). Le bouton ci-dessous déclenche un envoi
          immédiat, en dehors de ce cycle — utile pour un cas exceptionnel, ou pour tester tout de
          suite que l&rsquo;envoi fonctionne sans attendre la fin du mois.
        </p>
        <EnvoyerRapportsButton />
      </div>

      <div className="card">
        <h2>Historique d&rsquo;activité admin</h2>
        <p className="card-sub">
          Qui a fait quoi et quand — ajouts, suppressions, souscriptions, envois d&rsquo;emails
          (« Envoi automatique » = envoyé tout seul le dernier jour du mois ; « Envoi manuel » =
          déclenché avec le bouton ci-dessus). Les 200 entrées les plus récentes.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Heure</th>
                <th>Action</th>
                <th>Détail</th>
                <th>Par</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const [datePart, timePart] = e.ts.split('T');
                const heure = timePart ? timePart.slice(0, 5) : '—';
                const isSuppression = e.action === 'Suppression';
                return (
                  <tr key={e.id}>
                    <td>{fmtDate(datePart)}</td>
                    <td>{heure}</td>
                    <td>
                      <span className={`pill ${isSuppression ? 'neg' : 'pos'}`}>{e.action}</span>
                    </td>
                    <td>{e.detail}</td>
                    <td>{e.actor_id ? (nomByAuthId.get(e.actor_id) ?? '—') : 'Automatique'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5}>Aucune activité enregistrée pour le moment.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
