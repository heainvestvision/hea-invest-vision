import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Depuis Next.js 16, "middleware.ts" est renommé "proxy.ts" (même
// fonctionnement, nouveau nom) — et surtout, proxy.ts s'exécute sur le
// runtime Node.js plutôt que sur l'Edge Runtime. C'est ce qui résout
// l'erreur de déploiement Vercel "The Edge Function middleware is
// referencing unsupported modules" : cette erreur venait du fait que
// @supabase/ssr embarque en interne des modules Node (via
// @supabase/supabase-js) non supportés par l'Edge Runtime, même si notre
// code ne les utilise jamais concrètement ici.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
