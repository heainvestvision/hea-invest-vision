import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import type { Membre } from './types';

// À utiliser dans les Server Components / Route Handlers : renvoie le membre
// (avec son statut admin) lié à l'utilisateur Supabase Auth actuellement connecté.
// Redirige vers /login si personne n'est connecté, ou si le compte connecté n'est
// lié à aucune fiche membre (cas d'un compte créé mais pas encore rattaché par l'admin).
export async function requireMembre(): Promise<Membre> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: membre, error } = await supabase
    .from('membres')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (error || !membre) {
    redirect('/login?erreur=compte_non_rattache');
  }

  return membre as Membre;
}

export async function requireAdmin(): Promise<Membre> {
  const membre = await requireMembre();
  if (!membre.is_admin) redirect('/');
  return membre;
}
