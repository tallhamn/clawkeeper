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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleDismiss}
    >
      <div className="max-w-2xl px-8 text-center">
        {/* App Title */}
        <h1 className="text-4xl font-bold text-stone-800 mb-8 tracking-wide">
          WELLTIME
        </h1>

        {/* Main Message */}
        <div className="space-y-6 text-stone-600 leading-relaxed">
          <p className="text-lg">
            Hitting goals is much easier when you follow proven patterns. People often make
            things harder than they need to be.
          </p>

          <p className="text-lg">
            Use AI to find paths that actually work. Then reflect on your progress and watch
            Welltime adapt its recommendations to what works for you.
          </p>
        </div>

        {/* Dismiss hint */}
        <div className="mt-12">
          <button
            onClick={handleDismiss}
            className="px-6 py-2 bg-kyoto-light text-kyoto-red text-sm font-semibold rounded-lg hover:bg-kyoto-medium transition-colors"
          >
            Get Started
          </button>
        </div>

        <p className="text-xs text-stone-400 mt-8">
          Click anywhere to continue
        </p>
      </div>
    </div>
  );
}
