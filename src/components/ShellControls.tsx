'use client';

import { useEffect } from 'react';
import { Menu, Moon, Sun } from 'lucide-react';

export function MobileNavToggle() {
  return (
    <button
      className="mobile-toggle"
      aria-label="Buka menu"
      onClick={() => document.body.classList.toggle('nav-open')}
    >
      <Menu size={22} />
    </button>
  );
}

const THEME_KEY = 'crm_theme';

// Tema disimpan di atribut data-theme pada <html>; ikon yang tampil diatur lewat CSS.
export function ThemeToggle() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
    } catch {}
  }, []);

  const toggle = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  return (
    <button className="icon-button theme-toggle" onClick={toggle} title="Ganti tema terang/gelap" aria-label="Ganti tema">
      <Sun size={18} className="icon-sun" />
      <Moon size={18} className="icon-moon" />
    </button>
  );
}

/** Select yang langsung mengirim form induknya saat nilainya berubah. */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`dropdown-select ${props.className ?? ''}`}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}

export function NavBackdrop() {
  return <div className="nav-backdrop" onClick={() => document.body.classList.remove('nav-open')} />;
}
