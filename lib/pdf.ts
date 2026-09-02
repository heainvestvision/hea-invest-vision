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

// En-tête commune aux deux documents (fond blanc, nom du club à gauche, type de
// document + une ligne de sous-titre à droite) — reproduit fidèlement l'en-tête
// du gabarit Excel d'origine (pas de bandeau bordeaux plein comme dans une
// précédente version : le gabarit Excel n'en a pas).
function pdfHeaderDoc(doc: jsPDF, docLabel: string, rightSubtitle: string) {
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...PDF_MAROON);
  doc.text('HEA INVEST VISION', 14, 16);

  doc.setFont('times', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_GRAY_LABEL);
  doc.text("Club d'investissement HEA", 14, 21.5);

  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_DARK);
  doc.text(pdfStr(docLabel), 196, 14, { align: 'right' });

  doc.setFont('times', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...PDF_GRAY_LABEL);
  doc.text(pdfStr(rightSubtitle), 196, 19, { align: 'right' });

  doc.setDrawColor(...PDF_MAROON);
  doc.setLineWidth(0.6);
  doc.line(14, 25, 196, 25);
  doc.setTextColor(...PDF_DARK);
}

// Table de statistiques à cellules carrées (bordées, façon tableur) — chaque
// "ligne" logique de KPI devient deux lignes physiques dans le tableau : une
// ligne d'étiquettes (fond gris clair, petit texte gris) suivie d'une ligne de
// valeurs (texte bordeaux, gras). Reproduit le style "tableau" du gabarit Excel
// (à la différence des cartes arrondies de pdfKpiRow, utilisées par l'avis).
function pdfStatTable(
  doc: jsPDF,
  y0: number,
  rows: { label: string; value: string }[][]
): number {
  const body: string[][] = [];
  rows.forEach((row) => {
    body.push(row.map((c) => pdfStr(c.label)));
    body.push(row.map((c) => pdfStr(c.value)));
  });
  autoTable(doc, {
    startY: y0,
    body,
    theme: 'grid',
    styles: {
      font: 'times',
      halign: 'center',
      valign: 'middle',
      lineColor: PDF_MAROON2,
      lineWidth: 0.2,
    },
    didParseCell: (data) => {
      const isLabelRow = data.row.index % 2 === 0;
      if (isLabelRow) {
        data.cell.styles.fillColor = PDF_GRAY_ALT;
        data.cell.styles.textColor = PDF_GRAY_LABEL;
        data.cell.styles.fontSize = 7.5;
        data.cell.styles.fontStyle = 'normal';
        data.cell.styles.cellPadding = { top: 3, bottom: 1, left: 2, right: 2 };
      } else {
        data.cell.styles.fillColor = PDF_WHITE;
        data.cell.styles.textColor = PDF_MAROON2;
        data.cell.styles.fontSize = 11;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.cellPadding = { top: 1, bottom: 3, left: 2, right: 2 };
      }
    },
    margin: { left: 14, right: 14 },
  });
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
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
  // Rang du membre dans le club (classement par capital apporté, déjà trié dans
  // la cap table du moteur) — ex. { position: 1, total: 22 } = "1er sur 22".
  rang: { position: number; total: number } | null;
}

export function buildRapportPdf(input: RapportInput): Buffer {
  const { membre, capRow, totals, mouvements, rang } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const civilite = membre.salutation ? `${membre.salutation} ` : '';
  const nomComplet = titleCase(membre.nom);
  const prenomAffiche = membre.prenom ? titleCase(membre.prenom) : nomComplet.split(' ')[0];

  const capital = capRow?.capital ?? 0;
  const parts = capRow?.parts ?? 0;
  const pct = capRow?.pct ?? 0;
  const valeur = capRow?.valeur_position ?? 0;
  const gain = capRow?.gain ?? 0;
  const perf = capRow?.perf ?? 0;

  pdfHeaderDoc(doc, 'RAPPORT INDIVIDUEL', `Arrêté au ${fmtDate(totals.dateArrete)}`);

  pdfLabeledBox(doc, 'Membre :', `${civilite}${nomComplet}`, 14, 32, 130);

  pdfSectionBar(doc, 'Votre situation au sein du club', 14, 182, 48);
  let y = pdfStatTable(doc, 56, [
    [
      { label: 'CAPITAL APPORTÉ', value: fmtNum(capital, 0) + ' FCFA' },
      { label: 'PARTS DÉTENUES', value: fmtNum(parts, 2) + ' parts' },
      { label: 'QUOTE-PART DU CLUB', value: fmtNum(pct * 100, 2) + ' %' },
    ],
    [
      { label: 'VALEUR DE VOTRE POSITION', value: fmtNum(valeur, 0) + ' FCFA' },
      { label: 'PLUS-VALUE LATENTE', value: (gain >= 0 ? '+' : '') + fmtNum(gain, 0) + ' FCFA' },
      { label: 'PERFORMANCE', value: fmtNum(perf * 100, 2) + ' %' },
    ],
  ]);

  y += 8;
  pdfSectionBar(doc, 'Historique de vos versements', 14, 182, y);
  y += 8;

  const totalMontant = mouvements.reduce((s, m) => s + m.montant, 0);
  const totalParts = mouvements.reduce((s, m) => s + (m.parts_calculees ?? 0), 0);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Date', 'Montant (FCFA)', 'Moyen', 'Parts achetées', 'Vague']],
    body: mouvements.map((m, i) => [
      pdfStr(String(mouvements.length - i)),
      pdfStr(m.en_attente ? 'en attente' : m.date_effective ? fmtDate(m.date_effective) : '—'),
      pdfStr(fmtNum(m.montant, 0)),
      pdfStr(m.moyen ?? '—'),
      pdfStr(m.parts_calculees !== null ? fmtNum(m.parts_calculees, 2) : '—'),
      pdfStr(m.vague ?? '—'),
    ]),
    foot: [['', pdfStr('TOTAL'), pdfStr(fmtNum(totalMontant, 0)), '', pdfStr(fmtNum(totalParts, 2)), '']],
    theme: 'grid',
    headStyles: { fillColor: PDF_MAROON2, textColor: PDF_WHITE, font: 'times', fontStyle: 'bold', fontSize: 8.5, lineColor: PDF_MAROON2 },
    bodyStyles: { font: 'times', fontSize: 8, textColor: PDF_DARK, lineColor: PDF_LINE },
    footStyles: { fillColor: PDF_MAROON, textColor: PDF_WHITE, font: 'times', fontStyle: 'bold', fontSize: 8.5, lineColor: PDF_MAROON2 },
    alternateRowStyles: { fillColor: PDF_GRAY_ALT },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  pdfSectionBar(doc, 'Votre positionnement dans le club', 14, 182, y);
  y = pdfStatTable(doc, y + 8, [
    [
      { label: 'VOTRE RANG DANS LE CLUB', value: rang ? `${rang.position}${rang.position === 1 ? 'er' : 'e'} sur ${rang.total}` : '—' },
      { label: 'CAPITAL TOTAL DU CLUB', value: fmtNum(totals.totalCapital, 0) + ' FCFA' },
      { label: 'PERFORMANCE GLOBALE DU CLUB', value: fmtNum(totals.perfGlobale * 100, 2) + ' %' },
    ],
  ]);

  y += 6;
  const recapLines = doc.splitTextToSize(
    pdfStr(
      `Cher(e) ${prenomAffiche}, votre apport initial de ${fmtNum(capital, 0)} FCFA représente ${fmtNum(pct * 100, 2)} % ` +
        `du capital du club. À la date d'arrêté, votre position vaut ${fmtNum(valeur, 0)} FCFA, soit une plus-value de ` +
        `${fmtNum(gain, 0)} FCFA (${fmtNum(perf * 100, 2)} %). Merci pour votre confiance. — Le bureau du club`
    ),
    174
  );
  const boxH = recapLines.length * 4.6 + 8;
  doc.setFillColor(...PDF_GRAY_ALT);
  doc.setDrawColor(...PDF_LINE);
  doc.rect(14, y, 182, boxH, 'FD');
  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_GRAYTXT);
  doc.text(recapLines, 18, y + 6);
  doc.setTextColor(...PDF_DARK);

  pdfFooter(doc);
  return Buffer.from(doc.output('arraybuffer'));
}

// Ligne "Label :" + encadré crème contenant la valeur — reproduit les deux
// lignes "Membre :" / "Date du dernier dépôt :" du gabarit Excel d'origine.
function pdfLabeledBox(
  doc: jsPDF,
  label: string,
  value: string,
  x0: number,
  y0: number,
  boxW: number,
  labelW = 52
) {
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PDF_DARK);
  doc.text(pdfStr(label), x0, y0 + 6.5);

  const boxX = x0 + labelW;
  doc.setFillColor(...PDF_CREAM);
  doc.setDrawColor(...PDF_MAROON2);
  doc.roundedRect(boxX, y0, boxW, 9.5, 1.2, 1.2, 'FD');
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...PDF_MAROON);
  doc.text(pdfStr(value), boxX + 4, y0 + 6.5);
  doc.setTextColor(...PDF_DARK);
}

export interface AvisInput {
  membre: Membre;
  montant: number;
  dateSouscription: string;
  vlPart: number;
  partsAttribuees: number;
  vague: string;
  moyen: string | null;
  fraisIndividuels: number;
  totalFraisVague: number;
  nombreSouscripteurs: number;
  // Position cumulée du membre après cette souscription (issue de la cap table
  // du moteur, qui inclut déjà cette écriture) — null si introuvable.
  position: { capital: number; parts: number; pct: number } | null;
}

export function buildAvisPdf(input: AvisInput): Buffer {
  const {
    membre,
    montant,
    dateSouscription,
    vlPart,
    partsAttribuees,
    vague,
    moyen,
    fraisIndividuels,
    totalFraisVague,
    nombreSouscripteurs,
    position,
  } = input;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const civilite = membre.salutation ? `${membre.salutation} ` : '';
  const nomComplet = titleCase(membre.nom);
  const prenomAffiche = membre.prenom ? titleCase(membre.prenom) : nomComplet.split(' ')[0];

  pdfHeaderDoc(doc, 'AVIS DE SOUSCRIPTION', `Document généré le ${fmtDate(aujourdhui)}`);

  pdfLabeledBox(doc, 'Membre :', `${civilite}${nomComplet}`, 14, 32, 130);
  pdfLabeledBox(doc, 'Date du dernier dépôt :', fmtDate(dateSouscription), 14, 45, 55, 62);

  pdfSectionBar(doc, 'Confirmation de votre versement', 14, 182, 62);

  let y = pdfStatTable(doc, 70, [
    [
      { label: 'MONTANT VERSÉ', value: fmtNum(montant, 0) + ' FCFA' },
      { label: 'MOYEN DE PAIEMENT', value: moyen ?? '—' },
      { label: 'VAGUE DE SOUSCRIPTION', value: vague },
    ],
    [
      { label: 'VL APPLIQUÉE (FCFA/PART)', value: fmtNum(vlPart, 4) + ' FCFA' },
      { label: 'PARTS ATTRIBUÉES', value: fmtNum(partsAttribuees, 4) },
      { label: "DATE D'EFFET", value: fmtDate(dateSouscription) },
    ],
    [
      { label: 'TOTAL FRAIS DE LA VAGUE', value: fmtNum(totalFraisVague, 0) + ' FCFA' },
      { label: 'NOMBRE DE SOUSCRIPTEURS', value: String(nombreSouscripteurs) },
      { label: 'FRAIS INDIVIDUELS APPLIQUÉS', value: fmtNum(fraisIndividuels, 0) + ' FCFA' },
    ],
  ]);

  y += 8;
  pdfSectionBar(doc, 'Votre position globale au sein du club', 14, 182, y);

  y = pdfStatTable(doc, y + 8, [
    [
      { label: 'CAPITAL APPORTÉ (CUMULÉ)', value: fmtNum(position?.capital ?? montant, 0) + ' FCFA' },
      { label: 'PARTS DÉTENUES (TOTAL)', value: fmtNum(position?.parts ?? partsAttribuees, 4) },
      { label: 'QUOTE-PART DU CLUB', value: fmtNum((position?.pct ?? 0) * 100, 2) + ' %' },
    ],
  ]);

  const totalCapitalTxte = fmtNum(position?.capital ?? montant, 0);
  const totalPartsTxte = fmtNum(position?.parts ?? partsAttribuees, 4);
  const pctTxte = fmtNum((position?.pct ?? 0) * 100, 2);
  const recapLines = doc.splitTextToSize(
    pdfStr(
      `Cher(e) ${prenomAffiche}, nous accusons réception de votre versement de ${fmtNum(montant, 0)} FCFA ` +
        `effectué le ${fmtDate(dateSouscription)}${moyen ? ` par ${moyen}` : ''}. Ce versement vous a été attribué ` +
        `${fmtNum(partsAttribuees, 2)} parts, sur la base d'une valeur liquidative de ${fmtNum(vlPart, 2)} FCFA par part (${vague}). ` +
        `Votre position totale au sein du club s'élève désormais à ${totalCapitalTxte} FCFA, soit ${totalPartsTxte} parts ` +
        `(${pctTxte} % du capital du club). Merci pour votre confiance. — Le bureau du club`
    ),
    174
  );
  y += 16;
  const boxH = recapLines.length * 4.6 + 8;
  doc.setFillColor(...PDF_GRAY_ALT);
  doc.setDrawColor(...PDF_LINE);
  doc.rect(14, y, 182, boxH, 'FD');
  doc.setFont('times', 'italic');
  doc.setFontSize(9.5);
  doc.setTextColor(...PDF_GRAYTXT);
  doc.text(recapLines, 18, y + 6);
  doc.setTextColor(...PDF_DARK);

  pdfFooter(doc);
  return Buffer.from(doc.output('arraybuffer'));
}
