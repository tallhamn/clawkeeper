import { useState, useEffect, useRef } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { formatInterval, formatTimeSince, isHabitAvailable } from '@clawkeeper/shared/src/utils';

type RevealedItem = { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;

interface HabitItemProps {
  habit: Habit;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, intervalHours: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddNote: (id: string, text: string) => void;
  revealedItem: RevealedItem;
  onSetRevealed: (item: RevealedItem) => void;
}

type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export function HabitItem({
  habit,
  onComplete,
  onDelete,
  onUpdateInterval,
  onUpdateText,
  onAddNote,
  revealedItem,
  onSetRevealed,
}: HabitItemProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(habit.text);
  const [newNoteText, setNewNoteText] = useState('');
  const [isEditingInterval, setIsEditingInterval] = useState(false);
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('days');
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [streakTransition, setStreakTransition] = useState('');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const previousTotalCompletions = useRef(habit.totalCompletions);

  const isDue = isHabitAvailable(habit.lastCompleted, habit.repeatIntervalHours, habit.forcedAvailable);
  const isResting = !isDue;

  const isExpanded = revealedItem?.type === 'habit' && revealedItem?.id === habit.id && revealedItem?.mode === 'edit';
  const showNotes = revealedItem?.type === 'habit' && revealedItem?.id === habit.id && revealedItem?.mode === 'notes';

  useEffect(() => {
    if (habit.totalCompletions > previousTotalCompletions.current) {
      setStreakTransition(`${previousTotalCompletions.current}x\u2192${habit.totalCompletions}x`);
      setShowStreakAnimation(true);
      const timer = setTimeout(() => setShowStreakAnimation(false), 2000);
      previousTotalCompletions.current = habit.totalCompletions;
      return () => clearTimeout(timer);
    }
    previousTotalCompletions.current = habit.totalCompletions;
  }, [habit.totalCompletions]);

  const getIntervalParts = (hours: number): { value: number; unit: IntervalUnit } => {
    if (hours % (24 * 7) === 0) return { value: hours / (24 * 7), unit: 'weeks' };
    if (hours % 24 === 0) return { value: hours / 24, unit: 'days' };
    if (hours >= 1) return { value: hours, unit: 'hours' };
    return { value: hours * 60, unit: 'minutes' };
  };

  const getHoursFromInterval = (value: number, unit: IntervalUnit): number => {
    switch (unit) {
      case 'minutes': return value / 60;
      case 'hours': return value;
      case 'days': return value * 24;
      case 'weeks': return value * 24 * 7;
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
    <div className="group py-2.5 relative">
      <div className="flex items-start gap-2.5">
        {/* Due: checkbox / Resting: power symbol */}
        {isDue ? (
          <button
            onClick={() => onComplete(habit.id)}
            className="mt-0.5 w-6 h-6 rounded border-2 border-tokyo-blue/40 active:border-tokyo-blue flex items-center justify-center transition-all flex-shrink-0"
          />
        ) : (
          <div className="mt-0.5 w-6 h-6 flex items-center justify-center flex-shrink-0" style={{ opacity: 0.5 }}>
            <span className="text-lg leading-none">{'\u23FB'}</span>
          </div>
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
                    if (e.key === 'Escape') { setEditText(habit.text); setIsEditingText(false); }
                  }}
                  className="w-full px-3 py-2 bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue text-sm"
                  autoFocus
                />
              ) : (
                <span className={`text-tokyo-text-bright transition-all ${isResting ? 'line-through opacity-50' : ''}`}>
                  <span onClick={handleTextClick} className="cursor-pointer active:text-tokyo-blue">
                    {habit.text}
                  </span>
                  <span className="text-tokyo-yellow ml-1.5">
                    {'• '}
                    {formatTimeSince(habit.lastCompleted, habit.totalCompletions)}
                  </span>
                </span>
              )}
            </div>

            {/* Three-dot menu */}
            <button
              onClick={() => onSetRevealed(isExpanded ? null : { type: 'habit', id: habit.id, mode: 'edit' })}
              className="p-1.5 text-tokyo-text-dim active:text-tokyo-text-muted rounded flex-shrink-0"
              title="Edit habit"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>

          {/* Expanded edit menu */}
          {isExpanded && (
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
                            : 'bg-tokyo-surface-alt text-tokyo-text-muted'
                        }`}
                      >
                        {unit}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleSaveInterval} className="px-2 py-0.5 text-xs bg-tokyo-blue text-white rounded">
                    Save
                  </button>
                  <button onClick={() => setIsEditingInterval(false)} className="px-2 py-0.5 text-xs text-tokyo-text-muted">
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <button onClick={() => setIsEditingText(true)} className="text-xs text-tokyo-cyan active:text-tokyo-text">
                    Edit name
                  </button>
                  <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                  <span onClick={handleStartEditingInterval} className="text-xs text-tokyo-yellow active:text-tokyo-text cursor-pointer">
                    every {formatInterval(habit.repeatIntervalHours)}
                  </span>
                  <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                  <button onClick={() => onDelete(habit.id)} className="text-xs text-tokyo-red active:text-tokyo-red/80">
                    Delete
                  </button>
                  <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                  <button onClick={() => onSetRevealed(null)} className="text-xs text-tokyo-green active:text-tokyo-text">
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

      {/* Notes panel */}
      {showNotes && (
        <div className="mt-3 ml-8 p-3 bg-tokyo-surface-alt rounded-lg border border-tokyo-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-tokyo-text-muted font-medium">Notes</p>
            <button
              onClick={() => { onSetRevealed(null); setNewNoteText(''); }}
              className="text-xs text-tokyo-text-dim active:text-tokyo-text-muted"
            >
              Close
            </button>
          </div>
          {habit.notes && habit.notes.length > 0 && (
            <div className="space-y-2 mb-3">
              {habit.notes.length > 4 && !showAllNotes && (
                <button onClick={() => setShowAllNotes(true)} className="text-xs text-tokyo-text-dim">
                  show {habit.notes.length - 4} older...
                </button>
              )}
              {(showAllNotes ? habit.notes : habit.notes.slice(-4)).map((note) => (
                <div key={note.id} className="text-sm text-tokyo-text px-3 py-2 border-l-2 border-tokyo-yellow">
                  <span className="text-[10px] text-tokyo-text-dim block mb-0.5">
                    {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                  </span>
                  <span className="whitespace-pre-wrap">{note.text}</span>
                </div>
              ))}
            </div>
          )}
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
                <button onClick={() => setNewNoteText('')} className="px-3 py-1 text-xs text-tokyo-text-muted">
                  Clear
                </button>
                <button onClick={handleSaveNewNote} className="px-4 py-2 text-xs bg-tokyo-blue text-white rounded-lg">
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
