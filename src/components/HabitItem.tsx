import { useState, useEffect, useRef } from 'react';
import type { Habit } from '@/lib/types';
import { formatInterval, formatTimeSince, isHabitAvailable, formatCountdown } from '@/lib/utils';
import { ENABLE_AUTO_REFLECTION } from '@/lib/constants';

interface HabitItemProps {
  habit: Habit;
  editMode?: boolean;
  onToggle: (id: string, action?: 'complete' | 'undo' | 'wakeup') => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, intervalHours: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddNote: (id: string, text: string) => void;
  revealedItem: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;
  onSetRevealed: (item: { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null) => void;
}

type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export function HabitItem({
  habit,
  editMode = false,
  onToggle,
  onDelete,
  onUpdateInterval,
  onUpdateText,
  onAddNote,
  revealedItem,
  onSetRevealed,
}: HabitItemProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(habit.text);
  const [reflectionText, setReflectionText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isEditingInterval, setIsEditingInterval] = useState(false);
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('days');
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [streakTransition, setStreakTransition] = useState('');
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [showTransitionToPower, setShowTransitionToPower] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [forcedDue, setForcedDue] = useState(false);
  const previousTotalCompletions = useRef(habit.totalCompletions);

  // Determine habit state (can be overridden by forcedAvailable or forcedDue for wake-up)
  const naturallyDue = isHabitAvailable(habit.lastCompleted, habit.repeatIntervalHours, habit.forcedAvailable);
  const isDue = naturallyDue || forcedDue;
  const isResting = !isDue;

  // Clear forcedDue when the habit naturally becomes due
  useEffect(() => {
    if (naturallyDue && forcedDue) {
      setForcedDue(false);
    }
  }, [naturallyDue, forcedDue]);

  // Check if this habit is currently revealed
  const isExpanded = revealedItem?.type === 'habit' && revealedItem?.id === habit.id && revealedItem?.mode === 'edit';
  const showReflectionInput = revealedItem?.type === 'habit' && revealedItem?.id === habit.id && revealedItem?.mode === 'reflection';
  const showNotes = revealedItem?.type === 'habit' && revealedItem?.id === habit.id && revealedItem?.mode === 'notes';

  // Detect totalCompletions changes and show animation
  useEffect(() => {
    if (habit.totalCompletions > previousTotalCompletions.current) {
      setStreakTransition(`${previousTotalCompletions.current}x→${habit.totalCompletions}x`);
      setShowStreakAnimation(true);

      const timer = setTimeout(() => {
        setShowStreakAnimation(false);
      }, 2000);

      previousTotalCompletions.current = habit.totalCompletions;
      return () => clearTimeout(timer);
    }
    previousTotalCompletions.current = habit.totalCompletions;
  }, [habit.totalCompletions]);

  // Update countdown every second when hovering over power symbol
  useEffect(() => {
    if (showCountdown && isResting && !showReflectionInput && !showCompletionAnimation && !showTransitionToPower) {
      const interval = setInterval(() => {
        setCountdown(formatCountdown(habit.lastCompleted, habit.repeatIntervalHours));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showCountdown, isResting, showReflectionInput, showCompletionAnimation, showTransitionToPower, habit.lastCompleted, habit.repeatIntervalHours]);

  // Clear countdown when reflection input opens
  useEffect(() => {
    if (showReflectionInput || showCompletionAnimation || showTransitionToPower) {
      setShowCountdown(false);
    }
  }, [showReflectionInput, showCompletionAnimation, showTransitionToPower]);

  // If reflection input closes while habit is still in completion state, transition to power symbol
  useEffect(() => {
    if (!showReflectionInput && showCompletionAnimation && !showTransitionToPower) {
      // Reflection was closed without save/skip - trigger transition
      transitionToPowerSymbol();
    }
  }, [showReflectionInput, showCompletionAnimation, showTransitionToPower]);

  const getIntervalParts = (hours: number): { value: number; unit: IntervalUnit } => {
    if (hours % (24 * 7) === 0) {
      return { value: hours / (24 * 7), unit: 'weeks' };
    } else if (hours % 24 === 0) {
      return { value: hours / 24, unit: 'days' };
    } else if (hours >= 1) {
      return { value: hours, unit: 'hours' };
    } else {
      return { value: hours * 60, unit: 'minutes' };
    }
  };

  const getHoursFromInterval = (value: number, unit: IntervalUnit): number => {
    switch (unit) {
      case 'minutes':
        return value / 60;
      case 'hours':
        return value;
      case 'days':
        return value * 24;
      case 'weeks':
        return value * 24 * 7;
    }
  };

  const handleStartEditingInterval = () => {
    const parts = getIntervalParts(habit.repeatIntervalHours);
    setIntervalValue(parts.value);
    setIntervalUnit(parts.unit);
    setIsEditingInterval(true);
  };

  const handleSaveInterval = () => {
    const hours = getHoursFromInterval(intervalValue, intervalUnit);
    onUpdateInterval(habit.id, hours);
    setIsEditingInterval(false);
  };

  const handleCancelInterval = () => {
    setIsEditingInterval(false);
  };

  const handleComplete = () => {
    // Normal completion flow (always increment when checkbox is clicked)
    // Clear forcedDue if it was set
    setForcedDue(false);

    // Clear countdown display
    setShowCountdown(false);

    // Show completion animation (checked + strikethrough, identical to task)
    setShowCompletionAnimation(true);

    // Increment totalCompletions immediately
    onToggle(habit.id, 'complete');

    // Show reflection input only if feature flag is enabled
    if (ENABLE_AUTO_REFLECTION) {
      onSetRevealed({ type: 'habit', id: habit.id, mode: 'reflection' });
    } else {
      // Skip to power symbol transition immediately
      transitionToPowerSymbol();
    }
  };

  const handleWakeUp = () => {
    // Wake up from standby: make habit available again without changing completion count
    // This sets forcedAvailable flag in the backend, which will trigger re-render
    onToggle(habit.id, 'wakeup');
  };

  const handleSaveReflection = () => {
    if (reflectionText.trim()) {
      onAddNote(habit.id, reflectionText.trim());
    }
    setReflectionText('');
    onSetRevealed(null);

    // Now transition to power symbol
    transitionToPowerSymbol();
  };

  const handleSkipReflection = () => {
    setReflectionText('');
    onSetRevealed(null);

    // Now transition to power symbol
    transitionToPowerSymbol();
  };

  const transitionToPowerSymbol = () => {
    // Keep checked state visible briefly
    setTimeout(() => {
      setShowCompletionAnimation(false);
      // Show transition to power symbol
      setShowTransitionToPower(true);

      setTimeout(() => {
        setShowTransitionToPower(false);
      }, 2000); // Longer morph animation
    }, 300);
  };

  const handleTextClick = () => {
    if (showNotes) {
      onSetRevealed(null);
    } else {
      onSetRevealed({ type: 'habit', id: habit.id, mode: 'notes' });
    }
  };

  const handleSaveText = () => {
    if (editText.trim()) {
      onUpdateText(habit.id, editText.trim());
    }
    setIsEditingText(false);
  };

  const handleSaveNewNote = () => {
    if (newNoteText.trim()) {
      onAddNote(habit.id, newNoteText.trim());
      setNewNoteText('');
    }
  };

  return (
    <div className="group py-2">
      <div className="flex items-center gap-3">
        {!editMode && (
          <>
            {/* Due state: Show checkbox (identical to tasks) */}
            {isDue && !showCompletionAnimation && !showTransitionToPower && (
              <button
                onClick={handleComplete}
                className="w-5 h-5 rounded border-2 border-tokyo-blue/40 hover:border-tokyo-blue flex items-center justify-center transition-all flex-shrink-0"
              >
              </button>
            )}

            {/* Completion animation: Checkbox with checkmark (identical to task) */}
            {showCompletionAnimation && (
              <div className="w-5 h-5 rounded border-2 border-tokyo-green bg-tokyo-green flex items-center justify-center transition-all flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {/* Transition animation: Morph to power symbol */}
            {showTransitionToPower && (
              <div className="w-5 h-5 flex items-center justify-center transition-all duration-1000 flex-shrink-0 animate-pulse">
                <span className="text-lg text-tokyo-magenta">⏻</span>
              </div>
            )}

            {/* Resting state: Power symbol */}
            {isResting && !showCompletionAnimation && !showTransitionToPower && !showReflectionInput && (
              <div className="relative flex-shrink-0">
                <button
                  onClick={handleWakeUp}
                  onMouseEnter={() => {
                    setShowCountdown(true);
                    setCountdown(formatCountdown(habit.lastCompleted, habit.repeatIntervalHours));
                  }}
                  onMouseLeave={() => setShowCountdown(false)}
                  className="w-5 h-5 flex items-center justify-center hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ opacity: 0.7 }}
                >
                  <span className="text-lg">⏻</span>
                </button>
                {showCountdown && (
                  <div className="absolute left-7 top-0 bg-tokyo-surface text-tokyo-text text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                    {countdown}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              {isEditingText ? (
                <input
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onBlur={handleSaveText}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveText();
                    if (e.key === 'Escape') {
                      setEditText(habit.text);
                      setIsEditingText(false);
                    }
                  }}
                  className="w-full px-3 py-2 bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue text-sm"
                  autoFocus
                />
              ) : (
                <span className={`text-tokyo-text-bright transition-all ${showCompletionAnimation || isResting ? 'line-through opacity-50' : ''}`}>
                  <span
                    onClick={editMode ? () => setIsEditingText(true) : handleTextClick}
                    className={editMode ? 'cursor-pointer hover:text-tokyo-text-bright' : 'cursor-pointer hover:text-tokyo-text-bright'}
                  >
                    {habit.text}
                  </span>
                  {!editMode && <span className="text-tokyo-yellow ml-1.5">• {formatTimeSince(habit.lastCompleted, habit.totalCompletions)}</span>}
                  {editMode && (
                    <span
                      onClick={handleStartEditingInterval}
                      className="text-tokyo-text-muted ml-1.5 cursor-pointer hover:text-tokyo-text-bright"
                    >
                      • every {formatInterval(habit.repeatIntervalHours)}
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Three-dot menu for edit in Do mode */}
            {!editMode && (
              <button
                onClick={() => onSetRevealed({ type: 'habit', id: habit.id, mode: 'edit' })}
                className="p-1 text-tokyo-text-dim hover:text-tokyo-text-muted rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Edit habit"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="12" cy="19" r="2" />
                </svg>
              </button>
            )}
            {/* Delete button in Edit mode */}
            {editMode && (
              <button
                onClick={() => onDelete(habit.id)}
                className="p-1 text-tokyo-text-dim hover:text-tokyo-red rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all flex-shrink-0"
                title="Delete habit"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          {/* Inline interval editor in Edit mode */}
          {editMode && isEditingInterval && (
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <span className="text-xs text-tokyo-text-muted">every</span>
              <input
                type="number"
                min="1"
                value={intervalValue}
                onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-12 px-1 py-0.5 text-xs bg-tokyo-surface-alt border border-tokyo-border rounded focus:outline-none focus:ring-1 focus:ring-tokyo-blue"
                autoFocus
              />
              <div className="flex gap-0.5">
                {(['minutes', 'hours', 'days', 'weeks'] as IntervalUnit[]).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setIntervalUnit(unit)}
                    className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                      intervalUnit === unit
                        ? 'bg-tokyo-blue text-white'
                        : 'bg-tokyo-surface-alt text-tokyo-text-muted hover:bg-tokyo-border/30'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSaveInterval}
                className="px-2 py-0.5 text-xs bg-tokyo-blue text-white rounded hover:bg-tokyo-blue-hover"
              >
                Save
              </button>
              <button
                onClick={handleCancelInterval}
                className="px-2 py-0.5 text-xs text-tokyo-text-muted hover:text-tokyo-text"
              >
                Cancel
              </button>
            </div>
          )}
          {/* Expanded menu in Do mode */}
          {!editMode && isExpanded && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isEditingInterval ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-tokyo-text-muted">every</span>
                  <input
                    type="number"
                    min="1"
                    value={intervalValue}
                    onChange={(e) => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 px-1 py-0.5 text-xs bg-tokyo-surface-alt border border-tokyo-border rounded focus:outline-none focus:ring-1 focus:ring-tokyo-blue"
                    autoFocus
                  />
                  <div className="flex gap-0.5">
                    {(['minutes', 'hours', 'days', 'weeks'] as IntervalUnit[]).map((unit) => (
                      <button
                        key={unit}
                        onClick={() => setIntervalUnit(unit)}
                        className={`px-1.5 py-0.5 text-xs rounded transition-colors ${
                          intervalUnit === unit
                            ? 'bg-tokyo-blue text-white'
                            : 'bg-tokyo-surface-alt text-tokyo-text-muted hover:bg-tokyo-border/30'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSaveInterval}
                    className="px-2 py-0.5 text-xs bg-tokyo-blue text-white rounded hover:bg-tokyo-blue-hover"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelInterval}
                    className="px-2 py-0.5 text-xs text-tokyo-text-muted hover:text-tokyo-text"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsEditingText(true)}
                    className="text-xs text-tokyo-cyan hover:text-tokyo-text"
                  >
                    Edit name
                  </button>
                  <span className="text-tokyo-text-dim">·</span>
                  <span
                    onClick={handleStartEditingInterval}
                    className="text-xs text-tokyo-yellow hover:text-tokyo-text cursor-pointer"
                  >
                    every {formatInterval(habit.repeatIntervalHours)}
                  </span>
                  <span className="text-tokyo-text-dim">·</span>
                  <button
                    onClick={() => onDelete(habit.id)}
                    className="text-xs text-tokyo-red hover:text-tokyo-red/80"
                  >
                    Delete
                  </button>
                  <span className="text-tokyo-text-dim">·</span>
                  <button
                    onClick={() => onSetRevealed(null)}
                    className="text-xs text-tokyo-green hover:text-tokyo-text"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Completion counter */}
        {habit.totalCompletions > 0 && (
          <div className="text-xs tabular-nums transition-all duration-300">
            {showStreakAnimation ? (
              <span className="text-tokyo-green font-semibold animate-pulse">{streakTransition}</span>
            ) : (
              <span className="text-tokyo-magenta">{habit.totalCompletions}x</span>
            )}
          </div>
        )}
      </div>

      {/* Reflection input after completing (only in Do mode) */}
      {!editMode && showReflectionInput && (
        <div className="mt-3 ml-8 p-3 bg-tokyo-surface-alt rounded-lg border border-tokyo-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-tokyo-text-muted font-medium">Any reflection?</p>
            <button
              onClick={handleSkipReflection}
              className="text-xs text-tokyo-text-dim hover:text-tokyo-text-muted"
            >
              Skip
            </button>
          </div>
          <div>
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="What worked today? Anything to remember?"
              className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none"
              rows={2}
              autoFocus
            />
            {reflectionText.trim() && (
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setReflectionText('')}
                  className="px-3 py-1 text-xs text-tokyo-text-muted hover:text-tokyo-text rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleSaveReflection}
                  className="px-4 py-2 text-xs bg-tokyo-blue text-white rounded-lg hover:bg-tokyo-blue-hover transition-colors"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes panel (only in Do mode) */}
      {!editMode && showNotes && (
        <div className="mt-3 ml-8 p-3 bg-tokyo-surface-alt rounded-lg border border-tokyo-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-tokyo-text-muted font-medium">Notes</p>
            <button
              onClick={() => {
                onSetRevealed(null);
                setNewNoteText('');
              }}
              className="text-xs text-tokyo-text-dim hover:text-tokyo-text-muted"
            >
              Close
            </button>
          </div>
          {habit.notes && habit.notes.length > 0 && (
            <div className="space-y-2 mb-3">
              {habit.notes.map((note, i) => (
                <div key={i} className="text-sm text-tokyo-text bg-tokyo-surface px-3 py-2 rounded border-l-2 border-tokyo-yellow">
                  <div className="whitespace-pre-wrap">{note.text}</div>
                  {note.createdAt && (
                    <div className="text-xs text-tokyo-text-dim mt-1">
                      {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Add new note */}
          <div>
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Add a note..."
              className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none"
              rows={2}
            />
            {newNoteText.trim() && (
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setNewNoteText('')}
                  className="px-3 py-1 text-xs text-tokyo-text-muted hover:text-tokyo-text rounded transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleSaveNewNote}
                  className="px-4 py-2 text-xs bg-tokyo-blue text-white rounded-lg hover:bg-tokyo-blue-hover transition-colors"
                >
                  Save
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
