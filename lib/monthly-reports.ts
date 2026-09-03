import { loadEngineAdmin } from '@/lib/data';
import { fmtDate, titleCase } from '@/lib/format';
import { buildRapportPdf } from '@/lib/pdf';
import { sendPdfEmail } from '@/lib/email';
import { createAdminClient } from '@/lib/supabase/server';
import type { Membre } from '@/lib/types';

export interface EnvoiResultat {
  membre: string;
  ok: boolean;
  erreur?: string;
}

// Génère et envoie le rapport individuel (PDF) par email à tous les membres ayant
// une adresse enregistrée — logique partagée par deux déclencheurs :
//  - la route cron (app/api/cron/monthly-reports/route.ts), automatiquement le
//    dernier jour de chaque mois : origine='Automatique', actorId=null ;
//  - le bouton admin « Envoyer maintenant » (app/historique/actions.ts), à la
//    demande, pour un cas exceptionnel ou pour vérifier que tout fonctionne sans
//    attendre la fin du mois : origine='Manuel', actorId=l'admin qui a cliqué.
// Chaque envoi (auto ou manuel) est journalisé dans `historique`, visible sur la
// page /historique — c'est ce qui permet de confirmer après coup que ça a marché.
export async function envoyerTousLesRapports(
  origine: 'Automatique' | 'Manuel',
  actorId: string | null
): Promise<{ resultats: EnvoiResultat[]; nbOk: number }> {
  const { engine, membres } = await loadEngineAdmin();
  const destinataires = (membres as Membre[]).filter((m) => !!m.email);

  const resultats: EnvoiResultat[] = [];

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
          (origine === 'Automatique' ? `Ceci est un envoi automatique mensuel.\n\n` : '') +
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
    action: origine === 'Automatique' ? 'Envoi automatique' : 'Envoi manuel',
    detail:
      `Rapports individuels envoyés — ${nbOk}/${resultats.length} réussi(s)` +
      (nbOk < resultats.length
        ? ` (échecs : ${resultats.filter((r) => !r.ok).map((r) => r.membre).join(', ')})`
        : ''),
    actor_id: actorId,
  });

  return { resultats, nbOk };
}
