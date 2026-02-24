interface UndoBarProps {
  show: boolean;
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoBar({ show, message, onUndo, onDismiss }: UndoBarProps) {
  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-tokyo-surface/95 backdrop-blur-sm border-b border-tokyo-border px-4 py-1.5 flex items-center justify-between">
      <span className="text-xs text-tokyo-text-muted truncate">{message}</span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onUndo}
          className="text-xs text-tokyo-blue font-medium active:text-tokyo-blue-hover"
        >
          Undo
        </button>
        <button onClick={onDismiss} className="text-tokyo-text-dim active:text-tokyo-text-muted p-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
