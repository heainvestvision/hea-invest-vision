import Link from 'next/link';
import type { Membre } from '@/lib/types';

const ADMIN_TABS = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/captable', label: 'Cap Table' },
  { href: '/journal', label: 'Journal' },
  { href: '/membres', label: 'Membres' },
  { href: '/avis', label: 'Avis de souscription' },
  { href: '/rapport', label: 'Rapports individuels' },
];

const MEMBRE_TABS = [
  { href: '/', label: 'Tableau de bord' },
  { href: '/captable', label: 'Cap Table' },
  { href: '/rapport', label: 'Mon rapport' },
];

export default function Shell({
  membre,
  active,
  children,
}: {
  membre: Membre;
  active: string;
  children: React.ReactNode;
}) {
  const tabs = membre.is_admin ? ADMIN_TABS : MEMBRE_TABS;
  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">HEA</div>
          <div className="brand-text">
            <h1>HEA Invest Vision</h1>
            <p>Club d&rsquo;investissement — Console de gestion</p>
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Connecté·e en tant que <b>{membre.salutation || membre.nom}</b>
          {membre.is_admin ? ' (admin)' : ''} —{' '}
          <form action="/auth/signout" method="post" style={{ display: 'inline' }}>
            <button type="submit" style={{ background: 'none', border: 0, color: 'var(--accent-ink)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0, textDecoration: 'underline' }}>
              se déconnecter
            </button>
          </form>
        </div>
      </div>
      <nav className="tabs">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={active === t.href ? 'active' : ''}>
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
