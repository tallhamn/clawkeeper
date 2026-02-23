import { useState, useEffect, useRef } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { formatInterval, formatTimeSince, isHabitAvailable, formatCountdown, getHabitMarkerHours } from '@clawkeeper/shared/src/utils';
import { ENABLE_AUTO_REFLECTION } from '@clawkeeper/shared/src/constants';

type RevealedItem = { type: 'habit' | 'task'; id: string; mode: 'reflection' | 'edit' | 'add-subtask' | 'notes' } | null;

interface HabitItemProps {
  habit: Habit;
  isTimelineHighlighted?: boolean;
  onHoverTimeline?: (id: string | null) => void;
  onToggle: (id: string, action?: 'complete' | 'wakeup' | 'skip') => void;
  onDelete: (id: string) => void;
  onUpdateInterval: (id: string, intervalHours: number) => void;
  onUpdateText: (id: string, text: string) => void;
  onAddNote: (id: string, text: string) => void;
  onEditNote: (habitId: string, noteId: string, newNoteText: string) => void;
  onDeleteNote: (habitId: string, noteId: string) => void;
  agents?: Array<{ id: string; name?: string }>;
  onAssignAgent?: (habitId: string, agentId: string) => void;
  onUnassignAgent?: (habitId: string) => void;
  revealedItem: RevealedItem;
  onSetRevealed: (item: RevealedItem) => void;
}

type IntervalUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export function HabitItem({
  habit,
  isTimelineHighlighted = false,
  onHoverTimeline,
  onToggle,
  onDelete,
  onUpdateInterval,
  onUpdateText,
  onAddNote,
  onEditNote,
  onDeleteNote,
  agents,
  onAssignAgent,
  onUnassignAgent,
  revealedItem,
  onSetRevealed,
}: HabitItemProps) {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState(habit.text);
  const [reflectionText, setReflectionText] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [isEditingInterval, setIsEditingInterval] = useState(false);
  const [intervalValue, setIntervalValue] = useState(1);
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>('days');
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [streakTransition, setStreakTransition] = useState('');
  const [showCompletionAnimation, setShowCompletionAnimation] = useState(false);
  const [showTransitionToPower, setShowTransitionToPower] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const previousTotalCompletions = useRef(habit.totalCompletions);

  const isDue = isHabitAvailable(habit.lastCompleted, habit.repeatIntervalHours, habit.forcedAvailable);
  const isResting = !isDue;

  const isExpanded = revealedItem?.type === 'habit' && revealedItem?.id === habit.id && revealedItem?.mode === 'edit';
  const showReflectionInput = revealedItem?.type === 'habit' && revealedItem?.id === habit.id && revealedItem?.mode === 'reflection';
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

  useEffect(() => {
    if (showCountdown && isResting && !showReflectionInput && !showCompletionAnimation && !showTransitionToPower) {
      const interval = setInterval(() => {
        setCountdown(formatCountdown(habit.lastCompleted, habit.repeatIntervalHours));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [showCountdown, isResting, showReflectionInput, showCompletionAnimation, showTransitionToPower, habit.lastCompleted, habit.repeatIntervalHours]);

  useEffect(() => {
    if (showReflectionInput || showCompletionAnimation || showTransitionToPower) setShowCountdown(false);
  }, [showReflectionInput, showCompletionAnimation, showTransitionToPower]);

  useEffect(() => {
    if (!showReflectionInput && showCompletionAnimation && !showTransitionToPower) {
      transitionToPowerSymbol();
    }
  }, [showReflectionInput, showCompletionAnimation, showTransitionToPower]);

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
    onUpdateInterval(habit.id, getHoursFromInterval(intervalValue, intervalUnit));
    setIsEditingInterval(false);
  };

  const handleComplete = () => {
    setShowCountdown(false);
    setShowCompletionAnimation(true);
    onToggle(habit.id, 'complete');
    if (ENABLE_AUTO_REFLECTION) {
      onSetRevealed({ type: 'habit', id: habit.id, mode: 'reflection' });
    } else {
      transitionToPowerSymbol();
    }
  };

  const handleWakeUp = () => onToggle(habit.id, 'wakeup');

  const handleSaveReflection = () => {
    if (reflectionText.trim()) onAddNote(habit.id, reflectionText.trim());
    setReflectionText('');
    onSetRevealed(null);
    transitionToPowerSymbol();
  };

  const handleSkipReflection = () => {
    setReflectionText('');
    onSetRevealed(null);
    transitionToPowerSymbol();
  };

  const transitionToPowerSymbol = () => {
    setTimeout(() => {
      setShowCompletionAnimation(false);
      setShowTransitionToPower(true);
      setTimeout(() => setShowTransitionToPower(false), 2000);
    }, 300);
  };

  const handleTextClick = () => {
    if (showNotes) onSetRevealed(null);
    else onSetRevealed({ type: 'habit', id: habit.id, mode: 'notes' });
  };

  const handleSaveText = () => {
    if (editText.trim()) onUpdateText(habit.id, editText.trim());
    setIsEditingText(false);
  };

  const handleSaveNewNote = () => {
    if (newNoteText.trim()) { onAddNote(habit.id, newNoteText.trim()); setNewNoteText(''); }
  };

  const getTimeLabel = (): string => {
    if (isResting || habit.preferredHour == null) return formatTimeSince(habit.lastCompleted, habit.totalCompletions);
    const now = new Date();
    const curHour = now.getHours() + now.getMinutes() / 60;
    const hours = getHabitMarkerHours(habit);
    let nearest: number | null = null;
    let nearestDiff = Infinity;
    for (const h of hours) { const d = h - curHour; if (d >= 0 && d < nearestDiff) { nearestDiff = d; nearest = h; } }
    if (nearest == null) { for (const h of hours) { const d = curHour - h; if (d >= 0 && d < Math.abs(nearestDiff)) { nearestDiff = -d; nearest = h; } } }
    if (nearest == null) return formatTimeSince(habit.lastCompleted, habit.totalCompletions);
    const diff = nearest - curHour;
    const abs = Math.abs(diff);
    if (abs < 0.5) return 'now';
    const r = Math.round(abs);
    return diff > 0 ? `in ${r}h` : `${r}h late`;
  };

  const agentMatch = habit.agentId && agents?.find(a => a.id === habit.agentId);

  return (
    <div
      className={`group py-2.5 relative transition-colors duration-150 ${isTimelineHighlighted ? 'bg-tokyo-blue-bg rounded' : ''}`}
      onMouseEnter={() => onHoverTimeline?.(habit.id)}
      onMouseLeave={() => onHoverTimeline?.(null)}
    >
      <div className="flex items-start gap-2.5">
        {isDue && !showCompletionAnimation && !showTransitionToPower && (
          <button onClick={handleComplete} className="mt-0.5 w-6 h-6 rounded border-2 border-tokyo-blue/40 active:border-tokyo-blue flex items-center justify-center transition-all flex-shrink-0" />
        )}
        {showCompletionAnimation && (
          <div className="mt-0.5 w-6 h-6 rounded border-2 border-tokyo-green bg-tokyo-green flex items-center justify-center transition-all flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        )}
        {showTransitionToPower && (
          <div className="mt-0.5 w-6 h-6 flex items-center justify-center transition-all duration-1000 flex-shrink-0 animate-pulse">
            <span className="text-lg leading-none text-tokyo-magenta">{'\u23FB'}</span>
          </div>
        )}
        {isResting && !showCompletionAnimation && !showTransitionToPower && !showReflectionInput && (
          <div className="relative flex-shrink-0">
            <button
              onClick={handleWakeUp}
              onMouseEnter={() => { setShowCountdown(true); setCountdown(formatCountdown(habit.lastCompleted, habit.repeatIntervalHours)); }}
              onMouseLeave={() => setShowCountdown(false)}
              className="mt-0.5 w-6 h-6 flex items-center justify-center active:opacity-100 transition-opacity cursor-pointer" style={{ opacity: 0.5 }}
            >
              <span className="text-lg leading-none">{'\u23FB'}</span>
            </button>
            {showCountdown && (
              <div className="absolute left-8 top-0 bg-tokyo-surface text-tokyo-text text-xs px-2 py-1 rounded whitespace-nowrap z-10">{countdown}</div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              {isEditingText ? (
                <input type="text" value={editText} onChange={e => setEditText(e.target.value)} onBlur={handleSaveText}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveText(); if (e.key === 'Escape') { setEditText(habit.text); setIsEditingText(false); } }}
                  className="w-full px-3 py-2 bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue text-sm" autoFocus />
              ) : (
                <span className={`text-tokyo-text-bright transition-all ${showCompletionAnimation || isResting ? 'line-through opacity-50' : ''}`}>
                  <span onClick={handleTextClick} className="cursor-pointer active:text-tokyo-blue">{habit.text}</span>
                  {(() => {
                    const timeLabel = getTimeLabel();
                    const showSkip = isDue && !isResting && habit.preferredHour != null && !timeLabel.startsWith('in ');
                    return (
                      <>
                        <span className="text-tokyo-yellow ml-1.5">{'• '}{timeLabel}</span>
                        {showSkip && <button onClick={e => { e.stopPropagation(); onToggle(habit.id, 'skip'); }} className="text-tokyo-red text-xs ml-1.5">skip</button>}
                      </>
                    );
                  })()}
                  {habit.agentId && (
                    <span className="text-[10px] text-tokyo-magenta bg-tokyo-magenta/10 px-1.5 py-0.5 rounded ml-1.5">
                      {agentMatch ? (agentMatch.name || agentMatch.id) : habit.agentId}
                    </span>
                  )}
                </span>
              )}
            </div>
            <button onClick={() => onSetRevealed(isExpanded ? null : { type: 'habit', id: habit.id, mode: 'edit' })} className="p-1.5 text-tokyo-text-dim active:text-tokyo-text-muted rounded flex-shrink-0" title="Edit habit">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
            </button>
          </div>

          {isExpanded && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {isEditingInterval ? (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-tokyo-text-muted">every</span>
                  <input type="number" min="1" value={intervalValue} onChange={e => setIntervalValue(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 px-1 py-0.5 text-xs bg-tokyo-surface-alt border border-tokyo-border rounded focus:outline-none focus:ring-1 focus:ring-tokyo-blue" autoFocus />
                  <div className="flex gap-0.5">
                    {(['minutes', 'hours', 'days', 'weeks'] as IntervalUnit[]).map(u => (
                      <button key={u} onClick={() => setIntervalUnit(u)} className={`px-1.5 py-0.5 text-xs rounded transition-colors ${intervalUnit === u ? 'bg-tokyo-blue text-white' : 'bg-tokyo-surface-alt text-tokyo-text-muted'}`}>{u}</button>
                    ))}
                  </div>
                  <button onClick={handleSaveInterval} className="px-2 py-0.5 text-xs bg-tokyo-blue text-white rounded">Save</button>
                  <button onClick={() => setIsEditingInterval(false)} className="px-2 py-0.5 text-xs text-tokyo-text-muted">Cancel</button>
                </div>
              ) : (
                <>
                  <button onClick={() => setIsEditingText(true)} className="text-xs text-tokyo-cyan active:text-tokyo-text">Edit name</button>
                  <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                  <span onClick={handleStartEditingInterval} className="text-xs text-tokyo-yellow active:text-tokyo-text cursor-pointer">every {formatInterval(habit.repeatIntervalHours)}</span>
                  {agents && agents.length > 0 && onAssignAgent && (
                    <>
                      <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                      <div className="relative">
                        <button onClick={() => setShowAgentMenu(!showAgentMenu)} className="text-xs text-tokyo-magenta active:text-tokyo-text">
                          {habit.agentId ? 'Change agent' : 'Assign agent'}
                        </button>
                        {showAgentMenu && (
                          <div className="absolute top-full left-0 mt-1 bg-tokyo-surface border border-tokyo-border rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
                            {agents.map(a => (
                              <button key={a.id} onClick={() => { onAssignAgent(habit.id, a.id); setShowAgentMenu(false); }}
                                className={`block w-full text-left px-3 py-1.5 text-xs active:bg-tokyo-surface-alt ${habit.agentId === a.id ? 'text-tokyo-magenta' : 'text-tokyo-text'}`}>
                                {a.name || a.id}
                              </button>
                            ))}
                            {habit.agentId && onUnassignAgent && (
                              <button onClick={() => { onUnassignAgent(habit.id); setShowAgentMenu(false); }}
                                className="block w-full text-left px-3 py-1.5 text-xs text-tokyo-red active:bg-tokyo-surface-alt border-t border-tokyo-border">Unassign</button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                  <button onClick={() => onDelete(habit.id)} className="text-xs text-tokyo-red active:text-tokyo-red/80">Delete</button>
                  <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                  <button onClick={() => { onSetRevealed(null); setShowAgentMenu(false); }} className="text-xs text-tokyo-green active:text-tokyo-text">Done</button>
                </>
              )}
            </div>
          )}
        </div>

        {habit.totalCompletions > 0 && (
          <div className="text-xs tabular-nums transition-all duration-300">
            {showStreakAnimation ? <span className="text-tokyo-green font-semibold animate-pulse">{streakTransition}</span> : <span className="text-tokyo-magenta">{habit.totalCompletions}x</span>}
          </div>
        )}
      </div>

      {showReflectionInput && (
        <div className="mt-3 ml-8 p-3 bg-tokyo-surface-alt rounded-lg border border-tokyo-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-tokyo-text-muted font-medium">Any reflection?</p>
            <button onClick={handleSkipReflection} className="text-xs text-tokyo-text-dim active:text-tokyo-text-muted">Skip</button>
          </div>
          <textarea value={reflectionText} onChange={e => setReflectionText(e.target.value)} placeholder="What worked today? Anything to remember?"
            className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none" rows={2} autoFocus />
          {reflectionText.trim() && (
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setReflectionText('')} className="px-3 py-1 text-xs text-tokyo-text-muted">Clear</button>
              <button onClick={handleSaveReflection} className="px-4 py-2 text-xs bg-tokyo-blue text-white rounded-lg">Save</button>
            </div>
          )}
        </div>
      )}

      {showNotes && (
        <div className="mt-3 ml-8 p-3 bg-tokyo-surface-alt rounded-lg border border-tokyo-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-tokyo-text-muted font-medium">Notes</p>
            <button onClick={() => { onSetRevealed(null); setNewNoteText(''); setEditingNoteId(null); }} className="text-xs text-tokyo-text-dim active:text-tokyo-text-muted">Close</button>
          </div>
          {habit.notes && habit.notes.length > 0 && (
            <div className="space-y-2 mb-3">
              {habit.notes.length > 4 && !showAllNotes && (
                <button onClick={() => setShowAllNotes(true)} className="text-xs text-tokyo-text-dim">show {habit.notes.length - 4} older...</button>
              )}
              {(showAllNotes ? habit.notes : habit.notes.slice(-4)).map(note => (
                <div key={note.id} className="group/note text-sm text-tokyo-text px-3 py-2 border-l-2 border-tokyo-yellow">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-tokyo-text-dim block mb-0.5">{note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); }} className="text-[10px] text-tokyo-text-dim active:text-tokyo-text-muted">Edit</button>
                      <span className="text-tokyo-text-dim">{'\u00B7'}</span>
                      <button onClick={() => onDeleteNote(habit.id, note.id)} className="text-[10px] text-tokyo-red active:text-tokyo-red/80">Delete</button>
                    </div>
                  </div>
                  {editingNoteId === note.id ? (
                    <div className="mt-1">
                      <textarea value={editingNoteText} onChange={e => setEditingNoteText(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none" rows={2} autoFocus />
                      <div className="flex justify-end gap-2 mt-1">
                        <button onClick={() => setEditingNoteId(null)} className="px-3 py-1 text-xs text-tokyo-text-muted">Cancel</button>
                        <button onClick={() => { if (editingNoteText.trim()) onEditNote(habit.id, note.id, editingNoteText.trim()); setEditingNoteId(null); }}
                          className="px-3 py-1 text-xs bg-tokyo-blue text-white rounded-lg">Save</button>
                      </div>
                    </div>
                  ) : <span className="whitespace-pre-wrap">{note.text}</span>}
                </div>
              ))}
            </div>
          )}
          <div>
            <textarea value={newNoteText} onChange={e => setNewNoteText(e.target.value)} placeholder="Add a note..."
              className="w-full px-3 py-2 text-sm bg-tokyo-surface-alt border border-tokyo-border rounded-lg focus:outline-none focus:ring-1 focus:ring-tokyo-blue resize-none" rows={2} />
            {newNoteText.trim() && (
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setNewNoteText('')} className="px-3 py-1 text-xs text-tokyo-text-muted">Clear</button>
                <button onClick={handleSaveNewNote} className="px-4 py-2 text-xs bg-tokyo-blue text-white rounded-lg">Save</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
