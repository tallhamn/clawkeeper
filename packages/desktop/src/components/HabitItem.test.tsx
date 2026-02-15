import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HabitItem } from './HabitItem';
import type { Habit } from '@clawkeeper/shared/src/types';

// Mock the constants module to enable auto-reflection for testing
vi.mock('@clawkeeper/shared/src/constants', () => ({
  ENABLE_AUTO_REFLECTION: true,
  APP_VERSION: '1.0.0',
  APP_DIR_NAME: '/.clawkeeper',
  CURRENT_MD_FILE: 'current.md',
  HISTORY_DIR: 'history',
  MAX_SNAPSHOTS: 20,
  UNDO_BAR_TIMEOUT: 10000,
  REINFORCEMENT_MESSAGE_DURATION: 4000,
}));

describe('HabitItem', () => {
  const mockHabit: Habit = {
    id: 'test-habit-1',
    text: 'Test Habit',
    repeatIntervalHours: 24,
    lastCompleted: null,
    totalCompletions: 0,
    notes: [],
  };

  const mockProps = {
    habit: mockHabit,
    editMode: false,
    onToggle: vi.fn(),
    onDelete: vi.fn(),
    onUpdateInterval: vi.fn(),
    onUpdateText: vi.fn(),
    onAddNote: vi.fn(),
    revealedItem: null,
    onSetRevealed: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Due State (Checkbox)', () => {
    it('should render unchecked checkbox when habit is due', () => {
      const { container } = render(<HabitItem {...mockProps} />);

      const checkbox = container.querySelector('[class*="border-tokyo-blue/40"]');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox?.className).toContain('rounded border-2');
    });

    it('should show habit text', () => {
      render(<HabitItem {...mockProps} />);

      expect(screen.getByText('Test Habit')).toBeInTheDocument();
    });

    it('should show "not done yet" for never-completed habit', () => {
      render(<HabitItem {...mockProps} />);

      expect(screen.getByText(/not done yet/)).toBeInTheDocument();
    });
  });

  describe('Completion Flow', () => {
    it('should call onToggle when checkbox is clicked', () => {
      const { container } = render(<HabitItem {...mockProps} />);

      const checkbox = container.querySelector('[class*="border-tokyo-blue/40"]')!;
      fireEvent.click(checkbox);

      // Should call with 'complete' action
      expect(mockProps.onToggle).toHaveBeenCalledWith('test-habit-1', 'complete');
    });

    it('should open reflection input after completion', () => {
      const { container } = render(<HabitItem {...mockProps} />);

      const checkbox = container.querySelector('[class*="border-tokyo-blue/40"]')!;
      fireEvent.click(checkbox);

      expect(mockProps.onSetRevealed).toHaveBeenCalledWith({
        type: 'habit',
        id: 'test-habit-1',
        mode: 'reflection',
      });
    });

    it('should show reflection input when revealed', () => {
      const props = {
        ...mockProps,
        revealedItem: { type: 'habit' as const, id: 'test-habit-1', mode: 'reflection' as const },
      };

      render(<HabitItem {...props} />);

      expect(screen.getByPlaceholderText(/What worked today/)).toBeInTheDocument();
      expect(screen.getByText('Any reflection?')).toBeInTheDocument();
    });

    it('should save reflection and close input', () => {
      const props = {
        ...mockProps,
        revealedItem: { type: 'habit' as const, id: 'test-habit-1', mode: 'reflection' as const },
      };

      render(<HabitItem {...props} />);

      const textarea = screen.getByPlaceholderText(/What worked today/);
      fireEvent.change(textarea, { target: { value: 'Great progress today!' } });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(mockProps.onAddNote).toHaveBeenCalledWith('test-habit-1', 'Great progress today!');
      expect(mockProps.onSetRevealed).toHaveBeenCalledWith(null);
    });

    it('should skip reflection without saving', () => {
      const props = {
        ...mockProps,
        revealedItem: { type: 'habit' as const, id: 'test-habit-1', mode: 'reflection' as const },
      };

      render(<HabitItem {...props} />);

      const skipButton = screen.getByText('Skip');
      fireEvent.click(skipButton);

      expect(mockProps.onAddNote).not.toHaveBeenCalled();
      expect(mockProps.onSetRevealed).toHaveBeenCalledWith(null);
    });

    it('should not show save button when reflection is empty', () => {
      const props = {
        ...mockProps,
        revealedItem: { type: 'habit' as const, id: 'test-habit-1', mode: 'reflection' as const },
      };

      render(<HabitItem {...props} />);

      // Save button should not be visible when textarea is empty
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('should transition to power symbol when reflection closes without save/skip', async () => {
      // This tests the bug fix: if reflection panel closes for any reason
      // (clicking elsewhere, ESC, etc.), habit should transition to standby

      const completedHabit: Habit = {
        ...mockHabit,
        lastCompleted: new Date().toISOString(),
        totalCompletions: 1,
      };

      const { rerender } = render(
        <HabitItem
          {...mockProps}
          habit={completedHabit}
          revealedItem={{ type: 'habit', id: 'test-habit-1', mode: 'reflection' }}
        />
      );

      // Reflection input should be showing
      expect(screen.getByPlaceholderText(/What worked today/)).toBeInTheDocument();

      // Now close the reflection panel without saving (simulating clicking elsewhere)
      rerender(
        <HabitItem
          {...mockProps}
          habit={completedHabit}
          revealedItem={null}
        />
      );

      // Should transition to power symbol state (not stuck in checked state)
      await waitFor(() => {
        expect(screen.getByText('⏻')).toBeInTheDocument();
      }, { timeout: 3000 });

      // Reflection input should be gone
      expect(screen.queryByPlaceholderText(/What worked today/)).not.toBeInTheDocument();
    });
  });

  describe('Resting State (Power Symbol)', () => {
    const restingHabit: Habit = {
      ...mockHabit,
      lastCompleted: new Date().toISOString(),
      totalCompletions: 5,
    };

    it('should show power symbol when habit is resting', () => {
      render(<HabitItem {...mockProps} habit={restingHabit} />);

      expect(screen.getByText('⏻')).toBeInTheDocument();
    });

    it('should show total completions count', () => {
      render(<HabitItem {...mockProps} habit={restingHabit} />);

      expect(screen.getByText('5x')).toBeInTheDocument();
    });

    it('should wake up (transition to checkbox) when power symbol is clicked', () => {
      const { container } = render(<HabitItem {...mockProps} habit={restingHabit} />);

      const powerButton = container.querySelector('button');
      expect(powerButton?.textContent).toBe('⏻');

      fireEvent.click(powerButton!);

      // Should now show checkbox instead of power symbol
      waitFor(() => {
        const checkbox = screen.getByRole('button');
        expect(checkbox.className).toContain('border-tokyo-blue/40');
      });
    });

    it('should show countdown on hover', async () => {
      render(<HabitItem {...mockProps} habit={restingHabit} />);

      const powerButton = screen.getByText('⏻').closest('button')!;

      fireEvent.mouseEnter(powerButton);

      await waitFor(() => {
        expect(screen.getByText(/active again in/)).toBeInTheDocument();
      });
    });

    it('should hide countdown on mouse leave', async () => {
      render(<HabitItem {...mockProps} habit={restingHabit} />);

      const powerButton = screen.getByText('⏻').closest('button')!;

      fireEvent.mouseEnter(powerButton);
      await waitFor(() => {
        expect(screen.getByText(/active again in/)).toBeInTheDocument();
      });

      fireEvent.mouseLeave(powerButton);

      await waitFor(() => {
        expect(screen.queryByText(/active again in/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    it('should not show checkbox in edit mode', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      // Should not have clickable checkbox
      const buttons = screen.queryAllByRole('button');
      const hasCheckbox = buttons.some(btn => btn.className.includes('border-tokyo-blue/40'));
      expect(hasCheckbox).toBe(false);
    });

    it('should show interval information in edit mode', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      expect(screen.getByText(/every 1d/)).toBeInTheDocument();
    });

    it('should show delete button in edit mode', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      const deleteButton = screen.getByTitle('Delete habit');
      expect(deleteButton).toBeInTheDocument();
    });

    it('should delete habit when delete button is clicked', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      const deleteButton = screen.getByTitle('Delete habit');
      fireEvent.click(deleteButton);

      expect(mockProps.onDelete).toHaveBeenCalledWith('test-habit-1');
    });

    it('should allow editing habit text', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      const habitText = screen.getByText('Test Habit');
      fireEvent.click(habitText);

      const input = screen.getByDisplayValue('Test Habit');
      fireEvent.change(input, { target: { value: 'Updated Habit' } });
      fireEvent.blur(input);

      expect(mockProps.onUpdateText).toHaveBeenCalledWith('test-habit-1', 'Updated Habit');
    });
  });

  describe('Interval Editing', () => {
    it('should open interval editor in edit mode', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      const intervalText = screen.getByText(/every 1d/);
      fireEvent.click(intervalText);

      expect(screen.getByText('minutes')).toBeInTheDocument();
      expect(screen.getByText('hours')).toBeInTheDocument();
      expect(screen.getByText('days')).toBeInTheDocument();
      expect(screen.getByText('weeks')).toBeInTheDocument();
    });

    it('should update interval when saved', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      const intervalText = screen.getByText(/every 1d/);
      fireEvent.click(intervalText);

      // Change to 4 hours
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '4' } });

      const hoursButton = screen.getByText('hours');
      fireEvent.click(hoursButton);

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(mockProps.onUpdateInterval).toHaveBeenCalledWith('test-habit-1', 4);
    });

    it('should cancel interval editing', () => {
      render(<HabitItem {...mockProps} editMode={true} />);

      const intervalText = screen.getByText(/every 1d/);
      fireEvent.click(intervalText);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockProps.onUpdateInterval).not.toHaveBeenCalled();
    });
  });

  describe('View Notes', () => {
    const habitWithNotes: Habit = {
      ...mockHabit,
      notes: [
        { text: 'First note', createdAt: '2026-02-12T10:00:00Z' },
        { text: 'Second note', createdAt: '2026-02-12T11:00:00Z' },
      ],
    };

    it('should show past notes when text is clicked', () => {
      const props = {
        ...mockProps,
        habit: habitWithNotes,
        revealedItem: { type: 'habit' as const, id: 'test-habit-1', mode: 'notes' as const },
      };

      render(<HabitItem {...props} />);

      expect(screen.getByText('First note')).toBeInTheDocument();
      expect(screen.getByText('Second note')).toBeInTheDocument();
    });

    it('should allow adding new note', () => {
      const props = {
        ...mockProps,
        habit: habitWithNotes,
        revealedItem: { type: 'habit' as const, id: 'test-habit-1', mode: 'notes' as const },
      };

      render(<HabitItem {...props} />);

      const textarea = screen.getByPlaceholderText(/Add a note/);
      fireEvent.change(textarea, { target: { value: 'New note' } });

      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(mockProps.onAddNote).toHaveBeenCalledWith('test-habit-1', 'New note');
    });
  });

  describe('Total Completions Animation', () => {
    it('should show transition animation when completions increase', async () => {
      const { rerender } = render(<HabitItem {...mockProps} habit={mockHabit} />);

      const updatedHabit = { ...mockHabit, totalCompletions: 1 };
      rerender(<HabitItem {...mockProps} habit={updatedHabit} />);

      await waitFor(() => {
        expect(screen.getByText('0x→1x')).toBeInTheDocument();
      });
    });
  });

  describe('Unchecking Habits', () => {
    it('should wake up from resting without reducing count', () => {
      // Habit that has been completed recently (in resting state)
      const restingHabit: Habit = {
        ...mockHabit,
        lastCompleted: new Date().toISOString(),
        totalCompletions: 5,
      };

      const onToggle = vi.fn();
      const { container, rerender } = render(
        <HabitItem
          {...mockProps}
          habit={restingHabit}
          onToggle={onToggle}
        />
      );

      // Should show power symbol in resting state
      expect(screen.getByText('⏻')).toBeInTheDocument();

      // Click power symbol to wake up
      const powerButton = container.querySelector('button');
      fireEvent.click(powerButton!);

      // Should call onToggle with 'wakeup' action (makes habit available without reducing count)
      expect(onToggle).toHaveBeenCalledWith('test-habit-1', 'wakeup');

      // Simulate the backend updating forcedAvailable to true
      const wokeUpHabit = { ...restingHabit, forcedAvailable: true };
      rerender(
        <HabitItem
          {...mockProps}
          habit={wokeUpHabit}
          onToggle={onToggle}
        />
      );

      // After waking up, should show empty checkbox that can be completed normally
      const checkbox = container.querySelector('[class*="border-tokyo-blue/40"]');
      expect(checkbox).toBeInTheDocument();
    });

    it('should complete habit normally when naturally due', () => {
      // Habit that is naturally due (never completed)
      const dueHabit: Habit = {
        ...mockHabit,
        lastCompleted: null,
        totalCompletions: 0,
      };

      const onToggle = vi.fn();
      const { container } = render(
        <HabitItem
          {...mockProps}
          habit={dueHabit}
          onToggle={onToggle}
        />
      );

      // Click checkbox - should complete
      const checkbox = container.querySelector('[class*="border-tokyo-blue/40"]');
      fireEvent.click(checkbox!);

      // Should call onToggle with 'complete' action
      expect(onToggle).toHaveBeenCalledWith('test-habit-1', 'complete');
    });

    it('should complete habit after waking up and clicking checkbox', () => {
      // Habit that has been completed recently (in resting state)
      const restingHabit: Habit = {
        ...mockHabit,
        lastCompleted: new Date().toISOString(),
        totalCompletions: 5,
      };

      const onToggle = vi.fn();
      const { container, rerender } = render(
        <HabitItem
          {...mockProps}
          habit={restingHabit}
          onToggle={onToggle}
        />
      );

      // Click power symbol to wake up
      const powerButton = container.querySelector('button');
      fireEvent.click(powerButton!);

      // Simulate the backend updating forcedAvailable to true
      const wokeUpHabit = { ...restingHabit, forcedAvailable: true };
      rerender(
        <HabitItem
          {...mockProps}
          habit={wokeUpHabit}
          onToggle={onToggle}
        />
      );

      // Clear the mock to test the next call
      onToggle.mockClear();

      // Now click the checkbox - should complete (increment again)
      const checkbox = container.querySelector('[class*="border-tokyo-blue/40"]');
      fireEvent.click(checkbox!);

      // Should call onToggle with 'complete' action
      expect(onToggle).toHaveBeenCalledWith('test-habit-1', 'complete');
    });
  });

  describe('Three-dot Menu (Do Mode)', () => {
    it('should show three-dot menu in do mode', () => {
      render(<HabitItem {...mockProps} />);

      const menuButton = screen.getByTitle('Edit habit');
      expect(menuButton).toBeInTheDocument();
    });

    it('should expand menu when clicked', () => {
      render(<HabitItem {...mockProps} />);

      const menuButton = screen.getByTitle('Edit habit');
      fireEvent.click(menuButton);

      expect(mockProps.onSetRevealed).toHaveBeenCalledWith({
        type: 'habit',
        id: 'test-habit-1',
        mode: 'edit',
      });
    });

    it('should show expanded menu options', () => {
      const props = {
        ...mockProps,
        revealedItem: { type: 'habit' as const, id: 'test-habit-1', mode: 'edit' as const },
      };

      render(<HabitItem {...props} />);

      expect(screen.getByText('Edit name')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });
});
