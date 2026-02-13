import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onDismiss: () => void;
}

export function SplashScreen({ onDismiss }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in after a brief delay
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // Wait for fade out animation before calling onDismiss
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-tokyo-bg transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleDismiss}
    >
      <div className="max-w-2xl px-8 text-center">
        {/* App Title */}
        <h1 className="text-4xl font-bold text-tokyo-blue mb-8 tracking-wide">
          WELLTIME
        </h1>

        {/* Main Message */}
        <div className="space-y-6 text-tokyo-text leading-relaxed">
          <p className="text-lg">
            Agentic task management — use AI to handle your todos.
          </p>

          <p className="text-lg">
            Track habits and tasks, stored as markdown for easy cross-agent access and editing.
          </p>
        </div>

        {/* Dismiss hint */}
        <div className="mt-12">
          <button
            onClick={handleDismiss}
            className="px-6 py-2 bg-tokyo-blue-bg text-tokyo-blue text-sm font-semibold rounded-lg hover:text-tokyo-blue-hover transition-colors"
          >
            Get Started
          </button>
        </div>

        <p className="text-xs text-tokyo-text-dim mt-8">
          Click anywhere to continue
        </p>
      </div>
    </div>
  );
}
