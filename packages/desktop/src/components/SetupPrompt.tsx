import { useState, useEffect } from 'react';
import { getActiveProvider, getProviderDisplayName, onProviderChange, providerReady } from '@/lib/claude';
import type { Provider } from '@/lib/claude';

const STORAGE_KEY = 'clawkeeper_setup_prompt_seen';

interface SetupPromptProps {
  onDismiss: () => void;
}

export function useSetupPrompt() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    providerReady.then(() => {
      if (cancelled) return;
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (!seen && getActiveProvider() === 'openclaw') {
          setShouldShow(true);
        }
      } catch {
        // localStorage unavailable
      }
    });

    return () => { cancelled = true; };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable
    }
    setShouldShow(false);
  };

  return { shouldShow, dismiss };
}

export function SetupPrompt({ onDismiss }: SetupPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const clawName = getProviderDisplayName();

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleDismiss = (accepted: boolean) => {
    if (accepted) {
      try {
        localStorage.setItem('clawkeeper_checkins_enabled', 'true');
      } catch {
        // localStorage unavailable
      }
    }
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="max-w-md mx-4 bg-tokyo-surface rounded-2xl p-6 shadow-xl border border-tokyo-border">
        <h2 className="text-lg font-semibold text-tokyo-blue mb-3">
          {clawName} is here
        </h2>

        <p className="text-sm text-tokyo-text leading-relaxed mb-4">
          ClawKeeper detected <span className="text-tokyo-cyan">{clawName}</span> running
          on this machine. Want {clawName} to periodically check in on your habits and
          offer support when things slip?
        </p>

        <ul className="text-xs text-tokyo-text-muted space-y-1.5 mb-6 ml-4">
          <li className="flex items-start gap-2">
            <span className="text-tokyo-green mt-0.5">-</span>
            <span>Gentle nudges when habits go quiet</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-tokyo-green mt-0.5">-</span>
            <span>Acknowledgement when streaks build</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-tokyo-green mt-0.5">-</span>
            <span>Remembers your reflections for continuity</span>
          </li>
        </ul>

        <div className="flex gap-3">
          <button
            onClick={() => handleDismiss(true)}
            className="flex-1 px-4 py-2 bg-tokyo-blue text-white text-sm font-medium rounded-lg hover:bg-tokyo-blue-hover transition-colors"
          >
            Enable check-ins
          </button>
          <button
            onClick={() => handleDismiss(false)}
            className="flex-1 px-4 py-2 bg-tokyo-surface-alt text-tokyo-text-muted text-sm rounded-lg hover:text-tokyo-text transition-colors border border-tokyo-border"
          >
            Not now
          </button>
        </div>

        <p className="text-xs text-tokyo-text-dim mt-3 text-center">
          You can change this later in settings
        </p>
      </div>
    </div>
  );
}
