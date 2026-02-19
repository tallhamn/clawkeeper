import { useState, useEffect } from 'react';
import type { Habit } from '@clawkeeper/shared/src/types';
import { getHabitMarkerHours } from '@clawkeeper/shared/src/utils';

interface HabitTimelineProps {
  habits: Habit[];
  currentHour: number;
  highlightHabitId?: string | null;
  onHoverHabit?: (id: string | null) => void;
}

interface TimelineEntry {
  hour: number;
  habitId: string;
  icon: string;
  label: string;
  kind: 'logged' | 'planned' | 'planned-past';
}


function computeEntries(habits: Habit[], nowHour: number): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const todayStr = new Date().toDateString();

  for (const habit of habits) {
    if (habit.preferredHour == null) continue;
    const icon = habit.icon ?? '◆';

    // Collect all of today's completions from history
    const todayCompletionHours: number[] = [];
    for (const ts of (habit.completionHistory || [])) {
      const d = new Date(ts);
      if (d.toDateString() === todayStr) {
        todayCompletionHours.push(d.getHours() + d.getMinutes() / 60);
      }
    }
    // Fallback: if no history but lastCompleted is today, use that
    if (todayCompletionHours.length === 0 && habit.lastCompleted) {
      const d = new Date(habit.lastCompleted);
      if (d.toDateString() === todayStr) {
        todayCompletionHours.push(d.getHours() + d.getMinutes() / 60);
      }
    }

    // Add logged entries for each completion today
    for (const completedHour of todayCompletionHours) {
      entries.push({
        hour: completedHour,
        habitId: habit.id,
        icon,
        label: habit.text,
        kind: 'logged',
      });
    }

    // Scheduled markers for the full day
    const hasCompletionToday = todayCompletionHours.length > 0;
    for (const hour of getHabitMarkerHours(habit)) {
      // Skip past scheduled hours if there's a logged completion (avoid clutter)
      if (hasCompletionToday && hour < nowHour) continue;
      entries.push({
        hour,
        habitId: habit.id,
        icon,
        label: habit.text,
        kind: hour >= nowHour ? 'planned' : 'planned-past',
      });
    }
  }

  entries.sort((a, b) => a.hour - b.hour);
  return entries;
}

interface LayoutItem {
  entry: TimelineEntry;
  pct: number;
  fontSize: number;
}

/** Nudge overlapping entries apart; shrink icons if too dense to fit. */
function layoutEntries(entries: TimelineEntry[]): LayoutItem[] {
  if (entries.length === 0) return [];

  const BASE_FONT = 11;
  const MIN_FONT = 6;
  const BASE_GAP = 2.8; // minimum % gap between centers at base font size

  // Start with natural positions
  let items: LayoutItem[] = entries.map((e) => ({
    entry: e,
    pct: (e.hour / 24) * 100,
    fontSize: BASE_FONT,
  }));

  // Nudge: push overlapping entries to the right
  function nudge(gap: number) {
    for (let i = 1; i < items.length; i++) {
      if (items[i].pct - items[i - 1].pct < gap) {
        items[i].pct = items[i - 1].pct + gap;
      }
    }
  }

  nudge(BASE_GAP);

  // If last entry overflows, shrink gap & font to fit
  const last = items[items.length - 1];
  if (last.pct > 98) {
    const firstPct = (entries[0].hour / 24) * 100;
    const available = 98 - firstPct;
    const neededGaps = entries.length - 1;
    const newGap = neededGaps > 0 ? Math.min(BASE_GAP, available / neededGaps) : BASE_GAP;
    const scale = Math.max(newGap / BASE_GAP, MIN_FONT / BASE_FONT);
    const fontSize = Math.max(MIN_FONT, Math.round(BASE_FONT * scale));

    // Reset to natural positions with new font
    items = entries.map((e) => ({
      entry: e,
      pct: (e.hour / 24) * 100,
      fontSize,
    }));
    nudge(newGap);
  }

  return items;
}

function getFractionalHour(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

export function HabitTimeline({ habits, highlightHabitId, onHoverHabit }: HabitTimelineProps) {
  const [nowHour, setNowHour] = useState(getFractionalHour);
  const [timelineHovered, setTimelineHovered] = useState(false);

  // Update the cursor every 30 seconds so it moves smoothly through the day
  useEffect(() => {
    const interval = setInterval(() => setNowHour(getFractionalHour()), 30000);
    return () => clearInterval(interval);
  }, []);

  const entries = computeEntries(habits, nowHour);

  if (entries.length === 0) return null;

  const nowPct = (nowHour / 24) * 100;
  const hasHighlight = highlightHabitId != null;

  return (
    <div
      className="px-4 border-b border-tokyo-border/30 flex items-center gap-1.5"
      onMouseEnter={() => setTimelineHovered(true)}
      onMouseLeave={() => { setTimelineHovered(false); onHoverHabit?.(null); }}
    >
      <svg className="w-5 h-5 flex-shrink-0 text-tokyo-text-dim self-end" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" title="Morning">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
      <div className="relative flex-1 h-7 overflow-visible">
        {/* Playhead — FCP-style triangle + vertical line, flush to top of container */}
        <div
          className="absolute z-20 -translate-x-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `${nowPct}%`, top: 0, bottom: 0 }}
        >
          <div
            className="w-0 h-0 flex-shrink-0"
            style={{
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: '5px solid #565a6e',
            }}
          />
          <div className="w-px flex-1 bg-tokyo-text-muted/50" />
        </div>
        {/* Entries — laid out to avoid overlaps */}
        {layoutEntries(entries).map(({ entry, pct, fontSize }, idx) => {
          const isTargeted = hasHighlight && entry.habitId === highlightHabitId;
          const isMissed = entry.kind === 'planned-past';
          const colorful = !isMissed && (isTargeted || (hasHighlight ? false : timelineHovered));

          return (
            <div
              key={`${entry.kind}-${entry.habitId}-${entry.hour}-${idx}`}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-150 cursor-default select-none ${
                colorful ? 'opacity-100' : isMissed ? 'opacity-20' : 'opacity-40'
              } ${!colorful ? 'grayscale' : ''} ${isTargeted ? 'z-30 scale-150' : 'z-10'}`}
              style={{ left: `${pct}%`, fontSize: isTargeted ? `${fontSize + 3}px` : `${fontSize}px`, lineHeight: 1 }}
              title={`${entry.label} — ${entry.kind === 'logged' ? 'done' : entry.kind === 'planned-past' ? 'missed' : 'planned'} ${formatHour(entry.hour)}`}
              onMouseEnter={() => onHoverHabit?.(entry.habitId)}
              onMouseLeave={() => onHoverHabit?.(null)}
            >
              {entry.icon}
            </div>
          );
        })}
      </div>
      <svg className="w-5 h-5 flex-shrink-0 text-tokyo-text-dim self-end" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" title="Night">
        <path d="M13 9.5A5.5 5.5 0 0 1 6.5 3 5.5 5.5 0 1 0 13 9.5z" />
      </svg>
    </div>
  );
}

function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const suffix = h >= 12 ? 'pm' : 'am';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${suffix}`;
}
