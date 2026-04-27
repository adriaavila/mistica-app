'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (isStandalone) return;
    if (localStorage.getItem('install-banner-dismissed')) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
      setShowIOS(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      setInstallEvent(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('install-banner-dismissed', '1');
    setDismissed(true);
    setInstallEvent(null);
    setShowIOS(false);
  };

  if (dismissed || (!installEvent && !showIOS)) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 88,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 32px)',
      maxWidth: 448,
      background: '#0EA5E9',
      color: '#fff',
      borderRadius: 14,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      boxShadow: '0 4px 20px rgba(14,165,233,0.35)',
      zIndex: 50,
    }}>
      <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Instala la app</strong>
        {showIOS
          ? <>Toca <strong>Compartir</strong> y luego <strong>"Agregar a pantalla de inicio"</strong> para instalar Mística.</>
          : <>Agrega Mística a tu pantalla de inicio para acceder más rápido.</>
        }
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        {installEvent && (
          <button
            onClick={handleInstall}
            style={{
              background: '#fff',
              color: '#0EA5E9',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Instalar
          </button>
        )}
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          No gracias
        </button>
      </div>
    </div>
  );
}
