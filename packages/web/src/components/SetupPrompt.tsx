import { useState, useEffect } from 'react';

const STORAGE_KEY = 'clawkeeper_setup_prompt_seen';

interface SetupPromptProps {
  onDismiss: () => void;
}

export function useSetupPrompt() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    // Check if chat endpoint is available (OpenClaw configured server-side)
    const check = async () => {
      try {
        const seen = localStorage.getItem(STORAGE_KEY);
        if (seen) return;

        // Probe the coach endpoint — if 503 then no OpenClaw
        const res = await fetch('/api/coach-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ systemPrompt: 'test', messages: [] }),
        });
        // 503 means no token configured, anything else means it's available
        if (res.status !== 503) {
          setShouldShow(true);
        }
      } catch {
        // Endpoint not reachable
      }
    };
    check();
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
          AI coaching is available
        </h2>

        <p className="text-sm text-tokyo-text leading-relaxed mb-4">
          ClawKeeper can use AI to periodically check in on your habits and
          offer support when things slip.
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
            className="flex-1 px-4 py-2 bg-tokyo-blue text-white text-sm font-medium rounded-lg active:bg-tokyo-blue-hover transition-colors"
          >
            Enable check-ins
          </button>
          <button
            onClick={() => handleDismiss(false)}
            className="flex-1 px-4 py-2 bg-tokyo-surface-alt text-tokyo-text-muted text-sm rounded-lg active:text-tokyo-text transition-colors border border-tokyo-border"
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
