import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Reçoit le lien magique cliqué depuis l'email de connexion, échange le code
// contre une session, puis redirige vers l'application.
//
// Rattache aussi automatiquement, à la toute première connexion, ce compte Auth
// à la fiche "membres" dont l'email correspond (créée à l'avance par l'admin
// dans l'onglet Membres) — sans ce rattachement, requireMembre() ne trouverait
// jamais de fiche et renverrait indéfiniment vers /login. On utilise le client
// admin ici car un membre pas encore rattaché n'a pas le droit d'écrire sur la
// table "membres" (RLS réservée à l'admin) ; c'est cette route serveur, qui vient
// de vérifier l'email via le lien magique, qui fait exception de façon contrôlée.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);
    const user = data?.user;

    if (user?.email) {
      const admin = createAdminClient();
      const { data: existing } = await admin
        .from('membres')
        .select('id, auth_user_id')
        .ilike('email', user.email)
        .maybeSingle();

      if (existing && !existing.auth_user_id) {
        await admin.from('membres').update({ auth_user_id: user.id }).eq('id', existing.id);
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
