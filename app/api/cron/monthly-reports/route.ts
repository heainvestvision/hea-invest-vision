import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { envoyerTousLesRapports } from '@/lib/monthly-reports';

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

  const { resultats, nbOk } = await envoyerTousLesRapports('Automatique', null);

  return NextResponse.json({ ok: true, envoyes: nbOk, total: resultats.length, resultats });
}
