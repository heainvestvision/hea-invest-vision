// Rafraîchit la session Supabase à chaque requête et protège les pages qui
// exigent d'être connecté. Appelé depuis middleware.ts à la racine du projet.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// /api/cron n'est pas dans la liste parce qu'un utilisateur y serait connecté :
// c'est Vercel Cron qui l'appelle directement, sans session ni cookie. Cette
// route se protège elle-même avec un secret dédié (CRON_SECRET), vérifié dans
// app/api/cron/monthly-reports/route.ts.
const PUBLIC_PATHS = ['/login', '/auth', '/api/cron'];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return response;
}
