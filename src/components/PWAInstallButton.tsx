import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, Smartphone, CheckCircle } from 'lucide-react';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' }> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  // If already running inside standalone app mode
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
        <CheckCircle className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Installed PWA</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Fallback guide for desktop/other browsers
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      <button
        id="pwa-install-btn"
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        className="premium-action premium-action-success premium-shimmer-border flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>{isIOS ? 'Add to Homescreen' : 'Install App'}</span>
      </button>

      {/* Installation Guide Modal (iOS Safari, iPad, & Browser Instructions) */}
      {showIOSGuide && typeof document !== 'undefined' && createPortal(
        <div
          id="pwa-install-modal"
          className="premium-modal-backdrop fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto p-3 sm:p-4"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="premium-modal premium-modal-frame w-full max-w-md my-auto flex flex-col rounded-2xl text-slate-100 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-start justify-between gap-2 border-b border-slate-800 p-4 pb-3 sm:p-5 sm:pb-3 shrink-0">
              <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                <div className="premium-inset-glass w-11 h-11 rounded-xl flex items-center justify-center p-1.5 overflow-hidden shrink-0">
                  <img src="/icon.svg" alt="EGX App Icon" className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <h3 className="break-words text-base font-bold leading-tight text-white">Install EGX Tracker</h3>
                  <p className="text-xs text-slate-400 mt-0.5">iOS, iPadOS &amp; Desktop Browser</p>
                </div>
              </div>
              <button
                id="close-pwa-guide-btn"
                onClick={() => setShowIOSGuide(false)}
                className="premium-icon-action -mr-1 -mt-1 shrink-0 rounded-lg p-1.5"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="premium-modal-scroll-body overflow-x-hidden p-4 sm:p-5 space-y-3 text-xs sm:text-sm text-slate-300">
              <div className="premium-modal-section flex items-start gap-3 p-3 rounded-xl">
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-white">1. Tap Share in Safari / Browser</span>
                  <p className="text-slate-400 mt-0.5 text-xs">
                    On iPhone / iPad Safari, tap the <span className="text-blue-400 font-medium">Share</span> button in the navigation bar.
                  </p>
                </div>
              </div>

              <div className="premium-modal-section flex items-start gap-3 p-3 rounded-xl">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-white">2. Select &apos;Add to Home Screen&apos;</span>
                  <p className="text-slate-400 mt-0.5 text-xs">
                    Scroll down the actions list and tap <span className="text-emerald-400 font-medium">Add to Home Screen</span>.
                  </p>
                </div>
              </div>

              <div className="premium-modal-section flex items-start gap-3 p-3 rounded-xl">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-semibold text-white">3. Launch as Native App</span>
                  <p className="text-slate-400 mt-0.5 text-xs">
                    Tap <strong className="text-white">Add</strong> in the top right. The app will launch with full screen standalone performance and instant startup!
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 pt-2 border-t border-slate-800 shrink-0">
              <button
                id="confirm-pwa-guide-btn"
                onClick={() => setShowIOSGuide(false)}
                className="premium-action premium-action-primary w-full py-2.5 rounded-xl font-medium text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
