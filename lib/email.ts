// Envoi d'email réel côté serveur, avec PDF joint automatiquement — la vraie
// solution au problème du prototype ("pourquoi c'est moi qui dois joindre le
// PDF ?"). Un mailto: (utilisé côté navigateur dans le prototype) ne peut
// techniquement pas joindre de fichier : c'est une limite universelle des
// navigateurs, pas un défaut de l'app. Ici, côté serveur, on envoie un vrai
// email SMTP avec la pièce jointe déjà attachée — l'admin n'a plus rien à faire.
//
// Utilise le compte Gmail dédié du club via nodemailer + un mot de passe
// d'application (App Password), tous deux fournis UNIQUEMENT par variables
// d'environnement (GMAIL_USER / GMAIL_APP_PASSWORD) — jamais en dur dans le code.
// Voir .env.local.example et le README pour la configuration.

import nodemailer from 'nodemailer';

let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      "Envoi d'email non configuré : les variables d'environnement GMAIL_USER et " +
        'GMAIL_APP_PASSWORD sont requises (voir .env.local.example / README).'
    );
  }

  cachedTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return cachedTransport;
}

export interface SendPdfEmailInput {
  to: string;
  subject: string;
  bodyText: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

export async function sendPdfEmail(input: SendPdfEmailInput): Promise<void> {
  const { to, subject, bodyText, pdfBuffer, pdfFilename } = input;
  const transport = getTransport();
  const from = process.env.GMAIL_USER!;

  await transport.sendMail({
    from: `"HEA Invest Vision" <${from}>`,
    to,
    subject,
    text: bodyText,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

export interface SendTextEmailInput {
  to: string;
  subject: string;
  bodyText: string;
}

// Variante sans pièce jointe — pour les rappels automatiques (ex: relance de
// valorisation), qui n'ont rien à joindre, contrairement aux rapports/avis en PDF.
export async function sendTextEmail(input: SendTextEmailInput): Promise<void> {
  const { to, subject, bodyText } = input;
  const transport = getTransport();
  const from = process.env.GMAIL_USER!;

  await transport.sendMail({
    from: `"HEA Invest Vision" <${from}>`,
    to,
    subject,
    text: bodyText,
  });
}
