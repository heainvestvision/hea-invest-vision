import { requireAdmin } from '@/lib/current-membre';
import { createClient } from '@/lib/supabase/server';
import { titleCase } from '@/lib/data';
import Shell from '@/components/Shell';
import { mettreAJourEmail, basculerAdmin } from './actions';
import type { Membre } from '@/lib/types';

export default async function MembresPage() {
  const membre = await requireAdmin();
  const supabase = await createClient();
  const { data: membres, error } = await supabase.from('membres').select('*').order('num');
  if (error) throw error;

  const adminCount = (membres as Membre[]).filter((m) => m.is_admin).length;

  return (
    <Shell membre={membre} active="/membres">
      <div className="card">
        <h2>Membres du club</h2>
        <p className="card-sub">
          L&rsquo;email de chaque membre sert à l&rsquo;envoi du rapport individuel et de l&rsquo;avis de
          souscription, et doit correspondre à l&rsquo;adresse avec laquelle le membre se connecte. Le
          statut admin donne accès au Journal, aux Membres et aux envois groupés — il doit toujours en
          rester au moins un.
        </p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Nom</th><th>Email</th><th>Admin</th><th></th></tr></thead>
            <tbody>
              {(membres as Membre[]).map((m) => {
                const dernierAdmin = m.is_admin && adminCount <= 1;
                return (
                  <tr key={m.id}>
                    <td>{m.num}</td>
                    <td>{titleCase(m.nom)}</td>
                    <td>
                      <form action={mettreAJourEmail} style={{ display: 'flex', gap: 8 }}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="email" name="email" defaultValue={m.email ?? ''} placeholder="email@exemple.com" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 13, fontFamily: 'inherit', minWidth: 220 }} />
                        <button type="submit" className="ghost" style={{ padding: '5px 10px', fontSize: 12 }}>Enregistrer</button>
                      </form>
                    </td>
                    <td>
                      <form action={basculerAdmin} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="nouveauStatut" value={(!m.is_admin).toString()} />
                        {m.is_admin && <span className="pill pos">admin</span>}
                        <button
                          type="submit"
                          className="ghost"
                          disabled={dernierAdmin}
                          title={dernierAdmin ? 'Il doit rester au moins un administrateur' : undefined}
                          style={{ padding: '4px 9px', fontSize: 11 }}
                        >
                          {m.is_admin ? 'Retirer admin' : 'Passer admin'}
                        </button>
                      </form>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                      {m.auth_user_id ? 'compte lié' : 'pas encore connecté'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
