import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireMembre } from '@/lib/current-membre';
import { createAdminClient } from '@/lib/supabase/server';
import { loadEngine, fmtDate, titleCase } from '@/lib/data';
import { buildRapportPdf } from '@/lib/pdf';
import { sendPdfEmail } from '@/lib/email';
import type { Membre } from '@/lib/types';

// Envoie le rapport individuel (PDF généré à la volée) par email, avec le PDF
// déjà en pièce jointe — aucune action manuelle de l'admin ou du membre.
// Un membre ne peut déclencher l'envoi que de son propre rapport ; un admin
// peut déclencher l'envoi pour n'importe quel membre (via { membreId } dans le body).
export async function POST(req: NextRequest) {
  const current = await requireMembre();

  let body: { membreId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // body vide = envoi de son propre rapport
  }

  const targetId = body.membreId || current.id;
  if (targetId !== current.id && !current.is_admin) {
    return NextResponse.json({ error: "Action réservée à l'administrateur." }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: membre, error } = await admin.from('membres').select('*').eq('id', targetId).single();
  if (error || !membre) {
    return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
  }
  if (!membre.email) {
    return NextResponse.json(
      { error: `Aucune adresse email enregistrée pour ${titleCase(membre.nom)}.` },
      { status: 400 }
    );
  }

  try {
    const { engine } = await loadEngine();
    const capRow = engine.capTable.find((c) => c.membre_id === targetId) ?? null;
    const mouvements = engine.journal
      .filter((e) => e.membre_id === targetId)
      .sort((a, b) => b.date.localeCompare(a.date));
    // engine.capTable est déjà trié par capital décroissant (voir engine.ts).
    const rangIndex = engine.capTable.findIndex((c) => c.membre_id === targetId);
    const rang = rangIndex === -1 ? null : { position: rangIndex + 1, total: engine.capTable.length };

    const pdfBuffer = buildRapportPdf({
      membre: membre as Membre,
      capRow,
      totals: engine.totals,
      mouvements,
      rang,
    });

    await sendPdfEmail({
      to: membre.email,
      subject: `HEA Invest Vision — Votre rapport individuel au ${fmtDate(engine.totals.dateArrete)}`,
      bodyText:
        `Bonjour ${titleCase(membre.nom)},\n\n` +
        `Veuillez trouver ci-joint votre rapport individuel HEA Invest Vision, arrêté au ` +
        `${fmtDate(engine.totals.dateArrete)}.\n\n` +
        `Cordialement,\nHEA Invest Vision`,
      pdfBuffer,
      pdfFilename: `rapport-${membre.nom.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inattendue lors de l'envoi.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
