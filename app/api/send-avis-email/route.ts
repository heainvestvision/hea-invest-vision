import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/current-membre';
import { createAdminClient } from '@/lib/supabase/server';
import { loadEngine, fmtDate, titleCase } from '@/lib/data';
import { buildAvisPdf } from '@/lib/pdf';
import { sendPdfEmail } from '@/lib/email';
import type { Membre } from '@/lib/types';

// Envoie l'avis de souscription (PDF généré à la volée) par email, avec le PDF
// déjà en pièce jointe. Réservé à l'admin. { entryId } désigne l'écriture de
// dépôt déjà souscrite (date_effective renseignée) pour laquelle générer l'avis.
export async function POST(req: NextRequest) {
  await requireAdmin();

  let body: { entryId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignoré — traité comme entryId manquant ci-dessous
  }

  if (!body.entryId) {
    return NextResponse.json({ error: 'entryId manquant.' }, { status: 400 });
  }

  try {
    const { engine } = await loadEngine();
    const entry = engine.journal.find((e) => e.id === body.entryId);
    if (!entry) {
      return NextResponse.json({ error: 'Écriture introuvable.' }, { status: 404 });
    }
    if (entry.type !== 'Dépôt' || entry.en_attente || entry.parts_calculees === null || !entry.membre_id) {
      return NextResponse.json(
        { error: "Cette écriture n'est pas un dépôt souscrit — impossible de générer un avis." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: membre, error } = await admin
      .from('membres')
      .select('*')
      .eq('id', entry.membre_id)
      .single();
    if (error || !membre) {
      return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 });
    }
    if (!membre.email) {
      return NextResponse.json(
        { error: `Aucune adresse email enregistrée pour ${titleCase(membre.nom)}.` },
        { status: 400 }
      );
    }

    const dateSouscription = entry.date_effective as string;
    // VL réellement appliquée à cette écriture, reconstituée à partir des parts
    // déjà calculées par le moteur (fidèle aussi bien pour la vague Fondateur —
    // où elle vaut vl_implicite — que pour une vague Post-fondation).
    const vlPart = (entry.montant - (entry.frais_impute || 0)) / entry.parts_calculees;

    const pdfBuffer = buildAvisPdf({
      membre: membre as Membre,
      montant: entry.montant,
      dateSouscription,
      vlPart,
      partsAttribuees: entry.parts_calculees,
      vague: entry.vague ?? '—',
    });

    await sendPdfEmail({
      to: membre.email,
      subject: `HEA Invest Vision — Avis de souscription du ${fmtDate(dateSouscription)}`,
      bodyText:
        `Bonjour ${titleCase(membre.nom)},\n\n` +
        `Veuillez trouver ci-joint votre avis de souscription HEA Invest Vision, effective au ` +
        `${fmtDate(dateSouscription)}.\n\n` +
        `Cordialement,\nHEA Invest Vision`,
      pdfBuffer,
      pdfFilename: `avis-souscription-${membre.nom.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur inattendue lors de l'envoi.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
