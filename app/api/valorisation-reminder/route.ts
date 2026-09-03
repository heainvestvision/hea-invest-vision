import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/format';
import { sendTextEmail } from '@/lib/email';

export const maxDuration = 30;

// Nombre de jours écoulés entre une date ISO ("YYYY-MM-DD") et une Date donnée,
// comparés en UTC (pas d'heure impliquée pour une colonne `date` Postgres).
function joursDepuis(dateStr: string, maintenant: Date): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const debut = Date.UTC(y, m - 1, d);
  const fin = Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate());
  return Math.round((fin - debut) / 86400000);
}

// Appelée automatiquement CHAQUE JOUR par Vercel Cron (voir vercel.json). Envoie un
// email de rappel à tous les admins exactement 7 jours, 14 jours, 21 jours... après
// la DERNIÈRE valorisation enregistrée — tant qu'aucune nouvelle valorisation n'est
// saisie, un rappel repart tous les 7 jours ; dès qu'une nouvelle valorisation est
// ajoutée, le compteur repart de zéro (elle devient la "dernière"), donc les rappels
// s'arrêtent jusqu'à la semaine suivante sans saisie.
//
// Protégée par CRON_SECRET (même variable d'environnement que
// app/api/cron/monthly-reports/route.ts — voir ce fichier pour le détail du
// mécanisme de protection).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: valorisations, error: eValor }, { data: membres, error: eMembres }] = await Promise.all([
    admin.from('valorisations').select('date').order('date', { ascending: false }).limit(1),
    admin.from('membres').select('nom, email, is_admin').eq('is_admin', true),
  ]);
  if (eValor) return NextResponse.json({ error: eValor.message }, { status: 500 });
  if (eMembres) return NextResponse.json({ error: eMembres.message }, { status: 500 });

  const derniereValo = valorisations?.[0]?.date as string | undefined;
  if (!derniereValo) {
    return NextResponse.json({ skipped: true, reason: 'Aucune valorisation enregistrée.' });
  }

  const jours = joursDepuis(derniereValo, new Date());
  if (jours <= 0 || jours % 7 !== 0) {
    return NextResponse.json({ skipped: true, jours });
  }

  const semaines = jours / 7;
  const destinataires = (membres ?? []).filter((m) => !!m.email);

  const resultats: { membre: string; ok: boolean; erreur?: string }[] = [];
  for (const m of destinataires) {
    try {
      await sendTextEmail({
        to: m.email!,
        subject: 'HEA Invest Vision — Rappel : nouvelle valorisation à saisir',
        bodyText:
          `Bonjour,\n\n` +
          `La dernière valorisation enregistrée dans HEA Invest Vision date du ${fmtDate(derniereValo)}, ` +
          `soit ${jours} jours (${semaines} semaine${semaines > 1 ? 's' : ''}). Merci de saisir la nouvelle ` +
          `valorisation du portefeuille dès que possible.\n\n` +
          `Ceci est un rappel automatique, envoyé chaque semaine tant qu'aucune nouvelle valorisation n'est saisie.\n\n` +
          `Cordialement,\nHEA Invest Vision`,
      });
      resultats.push({ membre: m.nom, ok: true });
    } catch (e) {
      resultats.push({
        membre: m.nom,
        ok: false,
        erreur: e instanceof Error ? e.message : 'Erreur inconnue',
      });
    }
  }

  const nbOk = resultats.filter((r) => r.ok).length;
  await admin.from('historique').insert({
    action: 'Rappel automatique',
    detail:
      `Rappel de valorisation envoyé (dernière valorisation : ${fmtDate(derniereValo)}, il y a ${jours} jours) ` +
      `— ${nbOk}/${resultats.length} réussi(s)` +
      (nbOk < resultats.length
        ? ` (échecs : ${resultats.filter((r) => !r.ok).map((r) => r.membre).join(', ')})`
        : ''),
    actor_id: null,
  });

  return NextResponse.json({ ok: true, jours, envoyes: nbOk, total: resultats.length, resultats });
}
