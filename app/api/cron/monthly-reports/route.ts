import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loadEngineAdmin } from '@/lib/data';
import { fmtDate, titleCase } from '@/lib/format';
import { buildRapportPdf } from '@/lib/pdf';
import { sendPdfEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/server';
import type { Membre } from '@/lib/types';

export const maxDuration = 60;

// Route appelée automatiquement par Vercel Cron (voir vercel.json à la racine du
// projet) tous les jours entre le 28 et le 31 du mois. Le format cron standard n'a
// pas de notion native de "dernier jour du mois" (qui varie : 28, 29, 30 ou 31 selon
// le mois) — on la simule ici : si "demain" tombe le 1er, alors "aujourd'hui" est
// bien le dernier jour du mois en cours, et on envoie les rapports ; sinon on ne fait
// rien (la route répond simplement "skipped", c'est normal les autres jours).
//
// Protégée par CRON_SECRET (variable d'environnement à créer sur Vercel) : Vercel
// l'envoie automatiquement en en-tête Authorization sur les appels cron, ce qui
// empêche n'importe qui d'appeler cette route depuis l'extérieur pour spammer les
// membres d'emails.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(now.getUTCDate() + 1);
  if (tomorrow.getUTCDate() !== 1) {
    return NextResponse.json({ skipped: true, reason: "Pas le dernier jour du mois." });
  }

  const { engine, membres } = await loadEngineAdmin();
  const destinataires = (membres as Membre[]).filter((m) => !!m.email);

  const resultats: { membre: string; ok: boolean; erreur?: string }[] = [];

  for (const membre of destinataires) {
    try {
      const capRow = engine.capTable.find((c) => c.membre_id === membre.id) ?? null;
      const mouvements = engine.journal
        .filter((e) => e.membre_id === membre.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      const rangIndex = engine.capTable.findIndex((c) => c.membre_id === membre.id);
      const rang = rangIndex === -1 ? null : { position: rangIndex + 1, total: engine.capTable.length };

      const pdfBuffer = buildRapportPdf({ membre, capRow, totals: engine.totals, mouvements, rang });

      await sendPdfEmail({
        to: membre.email!,
        subject: `HEA Invest Vision — Votre rapport individuel au ${fmtDate(engine.totals.dateArrete)}`,
        bodyText:
          `Bonjour ${titleCase(membre.nom)},\n\n` +
          `Veuillez trouver ci-joint votre rapport individuel HEA Invest Vision, arrêté au ` +
          `${fmtDate(engine.totals.dateArrete)}.\n\n` +
          `Ceci est un envoi automatique mensuel.\n\n` +
          `Cordialement,\nHEA Invest Vision`,
        pdfBuffer,
        pdfFilename: `rapport-${membre.nom.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      });
      resultats.push({ membre: membre.nom, ok: true });
    } catch (e) {
      resultats.push({
        membre: membre.nom,
        ok: false,
        erreur: e instanceof Error ? e.message : 'Erreur inconnue',
      });
    }
  }

  const nbOk = resultats.filter((r) => r.ok).length;
  const admin = createAdminClient();
  await admin.from('historique').insert({
    action: 'Envoi automatique',
    detail: `Rapports individuels mensuels envoyés — ${nbOk}/${resultats.length} réussi(s)` +
      (nbOk < resultats.length
        ? ` (échecs : ${resultats.filter((r) => !r.ok).map((r) => r.membre).join(', ')})`
        : ''),
    actor_id: null,
  });

  return NextResponse.json({ ok: true, envoyes: nbOk, total: resultats.length, resultats });
}
