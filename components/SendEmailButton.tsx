'use client';

import { useState } from 'react';

// Bouton générique qui déclenche l'envoi d'un email avec PDF joint via une
// route API serveur (voir app/api/send-report-email et app/api/send-avis-email).
// C'est la vraie réponse à "pourquoi c'est moi qui dois joindre le PDF" : le
// serveur génère le PDF et l'attache lui-même à un email SMTP réel — l'admin ou
// le membre n'a plus qu'à cliquer une fois, aucune manipulation manuelle requise.
export default function SendEmailButton({
  endpoint,
  payload,
  label = 'Envoyer par email',
}: {
  endpoint: string;
  payload?: Record<string, unknown>;
  label?: string;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleClick() {
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || "Échec de l'envoi.");
        return;
      }
      setStatus('ok');
      setMessage('Email envoyé, PDF joint automatiquement.');
    } catch {
      setStatus('error');
      setMessage('Erreur réseau — réessaie.');
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'sending'}
        className="primary"
        style={{ padding: '7px 14px', fontSize: 13 }}
      >
        {status === 'sending' ? 'Envoi en cours…' : label}
      </button>
      {message && (
        <span style={{ fontSize: 12, color: status === 'ok' ? 'var(--positive)' : 'var(--negative)' }}>
          {message}
        </span>
      )}
    </div>
  );
}
