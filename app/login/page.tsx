'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Petit composant séparé (lit useSearchParams pendant le rendu, sans effet ni
// setState) affichant un message explicite quand /auth/callback a redirigé ici
// faute d'avoir trouvé une fiche membre correspondant à l'email connecté. Isolé
// dans un <Suspense> pour que le reste de la page /login reste prérendable.
function MessageCompteNonRattache() {
  const searchParams = useSearchParams();
  if (searchParams.get('erreur') !== 'compte_non_rattache') return null;
  return (
    <p style={{ fontSize: 12.5, color: '#B1503A', margin: '0 0 16px' }}>
      Cette adresse email n&rsquo;est reliée à aucune fiche membre. Demande à
      l&rsquo;administrateur du club de vérifier ton adresse dans l&rsquo;onglet Membres, puis
      reconnecte-toi.
    </p>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F6F3F1',
        fontFamily: '"Times New Roman", Times, Georgia, serif',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #DAD6D5',
          borderRadius: 14,
          padding: '32px 30px',
          width: 360,
          maxWidth: '90vw',
          boxShadow: '0 6px 20px -8px rgba(42,41,44,.18)',
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'linear-gradient(155deg, #760416, #8B2636)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 14,
          }}
        >
          HEA
        </div>
        <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>HEA Invest Vision</h1>
        <p style={{ fontSize: 13, color: '#5D5B5F', margin: '0 0 22px' }}>
          Connecte-toi avec l&rsquo;adresse email associée à ton compte membre.
        </p>

        <Suspense fallback={null}>
          <MessageCompteNonRattache />
        </Suspense>

        {status === 'sent' ? (
          <p style={{ fontSize: 14, color: '#3F7A5C' }}>
            Un lien de connexion a été envoyé à <b>{email}</b>. Ouvre-le depuis ta boîte
            mail pour accéder à ton espace.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              required
              placeholder="ton.email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                border: '1px solid #DAD6D5',
                borderRadius: 8,
                padding: '9px 12px',
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              style={{
                background: '#760416',
                color: '#fff',
                border: 0,
                borderRadius: 9,
                padding: '10px 16px',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {status === 'sending' ? 'Envoi…' : 'Recevoir mon lien de connexion'}
            </button>
            {status === 'error' && (
              <p style={{ fontSize: 12.5, color: '#B1503A' }}>{errorMsg}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
