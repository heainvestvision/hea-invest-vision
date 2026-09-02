// Génération des PDF côté serveur (Rapport individuel + Avis de souscription).
// Portage du rendu jsPDF du prototype (même charte graphique : bordeaux/crème,
// Times New Roman, barres de section, grilles de KPI). Différence avec le
// prototype (navigateur) : ici on utilise la forme fonction `autoTable(doc, {...})`
// de jspdf-autotable (import ESM standalone), confirmée fonctionner en Node pur —
// le prototype utilisait la forme méthode `doc.autoTable({...})` propre au
// contexte navigateur. Les fonctions ci-dessous ne lisent aucune variable globale :
// elles prennent toutes leurs données en argument (contrairement au prototype qui
// lisait un objet DATA/engine global), pour rester appelables depuis une route API.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Membre } from './types';
import type { CapTableRow, JournalEnrichi } from './engine';
import { fmtNum, fmtDate, titleCase } from './data';

// jsPDF (comme la plupart des moteurs de rendu PDF) ne sait pas dessiner le
// caractère U+202F (espace fine insécable) que toLocaleString('fr-FR') utilise
// comme séparateur de milliers — sans ce correctif, les montants affichent un
// caractère manquant/carré à la place de l'espace. On le remplace par une
// espace normale avant tout doc.text(). Ce correctif doit être appliqué à
// TOUTE chaîne passée à doc.text()/splitTextToSize(), pas seulement aux montants.
const pdfStr = (s: unknown): string => String(s).replace(/[\s  ]/g, ' ');

const PDF_MAROON: [number, number, number] = [118, 4, 22]; // #760416
const PDF_MAROON2: [number, number, number] = [139, 38, 54]; // #8B2636
const PDF_CREAM: [number, number, number] = [255, 242, 204]; // #FFF2CC
const PDF_GRAY_LABEL: [number, number, number] = [110, 110, 110];
const PDF_GRAY_ALT: [number, number, number] = [245, 245, 245];
const PDF_DARK: [number, number, number] = [30, 30, 30];
const PDF_GRAYTXT: [number, number, number] = [90, 90, 90];
const PDF_WHITE: [number, number, number] = [255, 255, 255];
const PDF_LINE: [number, number, number] = [220, 220, 220];

function pdfSectionBar(doc: jsPDF, text: string, x0: number, w: number, y0: number, h = 8) {
  doc.setFillColor(...PDF_MAROON);
  doc.rect(x0, y0, w, h, 'F');
  doc.setTextColor(...PDF_WHITE);
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.text(pdfStr(text), x0 + 3, y0 + h / 2 + 3);
  doc.setTextColor(...PDF_DARK);
}

function pdfKpiRow(
  doc: jsPDF,
  x0: number,
  y0: number,
  colW: number,
  cells: { label: string; value: string }[]
) {
  const h = 18;
  cells.forEach((c, i) => {
    const x = x0 + i * colW;
    doc.setFillColor(...PDF_GRAY_ALT);
    doc.setDrawColor(...PDF_LINE);
    doc.roundedRect(x, y0, colW - 3, h, 1.5, 1.5, 'FD');
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...PDF_GRAY_LABEL);
    doc.text(pdfStr(c.label), x + 3, y0 + 6);
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...PDF_MAROON2);
    doc.text(pdfStr(c.value), x + 3, y0 + 14);
  });
  doc.setTextColor(...PDF_DARK);
}

function pdfHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(...PDF_MAROON);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(...PDF_CREAM);
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('HEA INVEST VISION', 14, 14);
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.text(pdfStr(title), 14, 22);
  doc.setFontSize(8);
  doc.setTextColor(230, 220, 190);
  doc.text(pdfStr(subtitle), 14, 27);
  doc.setTextColor(...PDF_DARK);
}

function pdfFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const genLe = pdfStr(`Document généré automatiquement le ${fmtDate(new Date().toISOString().slice(0, 10))} — HEA Invest Vision`);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_GRAY_LABEL);
    doc.text(genLe, 14, 290);
    doc.setTextColor(...PDF_DARK);
  }
}

export interface RapportInput {
  membre: Membre;
  capRow: CapTableRow | null;
  totals: {
    totalCapital: number;
    totalValeur: number;
    plusValue: number;
    perfGlobale: number;
    vlPart: number;
    dateArrete: string;
  };
  // Écritures de ce membre uniquement, triées date décroissante (à préparer côté appelant).
  mouvements: JournalEnrichi[];
}

export function buildRapportPdf(input: RapportInput): Buffer {
  const { membre, capRow, totals, mouvements } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  pdfHeader(doc, 'Rapport individuel', `Arrêté au ${fmtDate(totals.dateArrete)}`);

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...PDF_DARK);
  doc.text(pdfStr(titleCase(membre.nom)), 14, 40);

  pdfSectionBar(doc, `Position au ${fmtDate(totals.dateArrete)}`, 14, 182, 46);

  const capital = capRow?.capital ?? 0;
  const parts = capRow?.parts ?? 0;
  const pct = capRow?.pct ?? 0;
  const valeur = capRow?.valeur_position ?? 0;
  const gain = capRow?.gain ?? 0;
  const perf = capRow?.perf ?? 0;

  pdfKpiRow(doc, 14, 58, 45.5, [
    { label: 'CAPITAL VERSÉ', value: fmtNum(capital, 0) + ' F' },
    { label: 'PARTS DÉTENUES', value: fmtNum(parts, 2) },
    { label: '% DU CLUB', value: fmtNum(pct * 100, 2) + ' %' },
    { label: 'VALEUR POSITION', value: fmtNum(valeur, 0) + ' F' },
  ]);

  pdfKpiRow(doc, 14, 80, 91, [
    { label: 'GAIN / PERTE', value: (gain >= 0 ? '+' : '') + fmtNum(gain, 0) + ' F' },
    { label: 'PERFORMANCE', value: fmtNum(perf * 100, 2) + ' %' },
  ]);

  pdfSectionBar(doc, 'Mouvements', 14, 182, 106);

  autoTable(doc, {
    startY: 112,
    head: [['Date', 'Souscription', 'Type', 'Montant (FCFA)', 'Parts']],
    body: mouvements.map((m) => [
      fmtDate(m.date),
      m.en_attente ? 'en attente' : m.date_effective ? fmtDate(m.date_effective) : '—',
      m.type,
      fmtNum(m.montant, 0),
      m.parts_calculees !== null ? fmtNum(m.parts_calculees, 2) : '—',
    ]),
    theme: 'plain',
    headStyles: { fillColor: PDF_MAROON2, textColor: PDF_WHITE, font: 'times', fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { font: 'times', fontSize: 8.5, textColor: PDF_DARK },
    alternateRowStyles: { fillColor: PDF_GRAY_ALT },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  pdfFooter(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

export interface AvisInput {
  membre: Membre;
  montant: number;
  dateSouscription: string;
  vlPart: number;
  partsAttribuees: number;
  vague: string;
}

export function buildAvisPdf(input: AvisInput): Buffer {
  const { membre, montant, dateSouscription, vlPart, partsAttribuees, vague } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  pdfHeader(doc, 'Avis de souscription', `Vague : ${vague}`);

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_DARK);
  const civilite = membre.salutation ? `${membre.salutation} ` : '';
  doc.text(pdfStr(`${civilite}${titleCase(membre.nom)},`), 14, 42);

  const bodyLines = doc.splitTextToSize(
    pdfStr(
      `Nous vous confirmons la souscription de ${fmtNum(montant, 0)} FCFA au sein d'HEA Invest Vision, ` +
        `effective au ${fmtDate(dateSouscription)}, sur la base de la valeur liquidative en vigueur à cette date.`
    ),
    182
  );
  doc.setFontSize(10);
  doc.text(bodyLines, 14, 52);

  pdfSectionBar(doc, 'Détail de la souscription', 14, 182, 72);

  pdfKpiRow(doc, 14, 84, 45.5, [
    { label: 'MONTANT SOUSCRIT', value: fmtNum(montant, 0) + ' F' },
    { label: 'VL APPLIQUÉE', value: fmtNum(vlPart, 4) + ' F' },
    { label: 'PARTS ATTRIBUÉES', value: fmtNum(partsAttribuees, 4) },
    { label: "DATE D'EFFET", value: fmtDate(dateSouscription) },
  ]);

  doc.setFont('times', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_GRAYTXT);
  const noteLines = doc.splitTextToSize(
    pdfStr(
      "Ce document tient lieu d'avis de souscription et sera archivé dans votre espace membre. " +
        "Pour toute question relative à votre position, contactez l'administration du club."
    ),
    182
  );
  doc.text(noteLines, 14, 112);
  doc.setTextColor(...PDF_DARK);

  pdfFooter(doc);
  return Buffer.from(doc.output('arraybuffer'));
}
