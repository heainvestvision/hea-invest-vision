// Client Supabase côté serveur (Server Components, Route Handlers, Server Actions).
// Utilise les cookies de la requête pour retrouver la session de l'utilisateur connecté —
// c'est ce qui permet à Postgres (via RLS) de savoir qui pose la question.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // appelé depuis un Server Component (lecture seule) : le middleware
            // se charge déjà de rafraîchir la session, on peut ignorer ici.
          }
        },
      },
    }
  );
}

// Client "admin" — utilise la clé de service (jamais exposée au navigateur), qui
// contourne la RLS. Réservé aux routes serveur qui ont déjà vérifié elles-mêmes
// que l'appelant est admin (ex: envoi d'email groupé). Ne jamais importer ce
// fichier depuis un composant "use client".
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
