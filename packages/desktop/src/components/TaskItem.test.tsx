import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from './TaskItem';
import type { Task } from '@clawkeeper/shared/src/types';

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

// Mock getDueDateStatus and formatDueDate to control output in tests
vi.mock('@clawkeeper/shared/src/utils', async () => {
  const actual = await vi.importActual('@clawkeeper/shared/src/utils');
  return {
    ...actual,
    getDueDateStatus: (d: string | null) => {
      if (!d) return null;
      if (d === '2025-01-01') return 'overdue';
      if (d === '2025-03-15') return 'due-today';
      if (d === '2025-03-16') return 'upcoming';
      return 'future';
    },
    formatDueDate: (d: string | null) => {
      if (!d) return null;
      if (d === '2025-01-01') return '2d overdue';
      if (d === '2025-03-15') return 'today';
      if (d === '2025-03-16') return 'tomorrow';
      return 'in 5d';
    },
  };
});

describe('TaskItem Component', () => {
  const mockTask: Task = {
    id: 't1',
    text: 'Test task',
    completed: false,
    completedAt: null,
    dueDate: null,
    notes: [],
    children: [],
  };

  it('should render task text', () => {
    render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('Test task')).toBeInTheDocument();
  });

  it('should show reflection prompt when completing task', () => {
    const onSetRevealed = vi.fn();

    render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={onSetRevealed}
      />
    );

    // Get all buttons and select the first one (checkbox)
    const buttons = screen.getAllByRole('button');
    const checkbox = buttons[0];
    fireEvent.click(checkbox);

    // Should show reflection input instead of immediately toggling
    expect(onSetRevealed).toHaveBeenCalledWith({ type: 'task', id: 't1', mode: 'reflection' });
  });

  it('should call onToggle when unchecking completed task', () => {
    const onToggle = vi.fn();
    const completedTask: Task = {
      ...mockTask,
      completed: true,
      completedAt: '2025-01-05',
    };

    render(
      <TaskItem
        task={completedTask}
        depth={0}
        showCompleted={true}
        onToggle={onToggle}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    // Get all buttons and select the first one (checkbox)
    const buttons = screen.getAllByRole('button');
    const checkbox = buttons[0];
    fireEvent.click(checkbox);

    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('should show reflection input when completing task', () => {
    const { rerender } = render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    // Simulate revealing reflection input
    rerender(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'reflection' }}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByPlaceholderText(/What worked today/i)).toBeInTheDocument();
  });

  it('should render subtasks recursively', () => {
    const taskWithChildren: Task = {
      ...mockTask,
      children: [
        {
          id: 't2',
          text: 'Subtask 1',
          completed: false,
          completedAt: null,
          dueDate: null,
          notes: [],
          children: [],
        },
      ],
    };

    render(
      <TaskItem
        task={taskWithChildren}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('Test task')).toBeInTheDocument();
    expect(screen.getByText('Subtask 1')).toBeInTheDocument();
  });

  it('should not render completed task when showCompleted is false', () => {
    const completedTask: Task = {
      ...mockTask,
      completed: true,
      completedAt: '2025-01-05',
    };

    const { container } = render(
      <TaskItem
        task={completedTask}
        depth={0}
        showCompleted={false}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should display multiple notes', () => {
    const taskWithNotes: Task = {
      ...mockTask,
      notes: [
        { id: 'tn1', text: 'First note', createdAt: '2026-02-12T10:00:00Z' },
        { id: 'tn2', text: 'Second note', createdAt: '2026-02-12T11:00:00Z' },
      ],
    };

    render(
      <TaskItem
        task={taskWithNotes}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'notes' }}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('First note')).toBeInTheDocument();
    expect(screen.getByText('Second note')).toBeInTheDocument();
  });

  it('should uncheck completed task with single click', () => {
    const completedTask: Task = {
      ...mockTask,
      completed: true,
      completedAt: '2026-01-08',
    };

    const onToggle = vi.fn();
    const onSetRevealed = vi.fn();

    const { container } = render(
      <TaskItem
        task={completedTask}
        depth={0}
        showCompleted={true}
        onToggle={onToggle}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={onSetRevealed}
      />
    );

    // Click checkbox once
    const checkbox = container.querySelector('button');
    fireEvent.click(checkbox!);

    // Should call onToggle immediately (single click to uncheck)
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('t1');

    // Should close any open panels
    expect(onSetRevealed).toHaveBeenCalledWith(null);
  });

  it('should cancel pending completion if checkbox clicked again', () => {
    const onToggle = vi.fn();
    const onSetRevealed = vi.fn();

    const { container } = render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={onToggle}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={onSetRevealed}
      />
    );

    // First click - should show reflection input (pending state)
    const checkbox = container.querySelector('button');
    fireEvent.click(checkbox!);

    expect(onSetRevealed).toHaveBeenCalledWith({ type: 'task', id: 't1', mode: 'reflection' });

    // Second click - should cancel pending completion
    fireEvent.click(checkbox!);

    expect(onSetRevealed).toHaveBeenCalledWith(null);
    // Should NOT have called onToggle (task not actually completed)
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('should show note count badge when task has notes', () => {
    const taskWithNotes: Task = {
      ...mockTask,
      notes: [
        { id: 'tn1', text: 'First note', createdAt: '2026-02-12T10:00:00Z' },
        { id: 'tn2', text: 'Second note', createdAt: '2026-02-12T11:00:00Z' },
      ],
    };

    render(
      <TaskItem
        task={taskWithNotes}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show notes panel with existing notes', () => {
    const taskWithNotes: Task = {
      ...mockTask,
      notes: [
        { id: 'tn3', text: 'Research finding here', createdAt: '2026-02-12T10:00:00Z' },
      ],
    };

    render(
      <TaskItem
        task={taskWithNotes}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'notes' }}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Research finding here')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Add a note...')).toBeInTheDocument();
  });

  it('should call onAddNote when saving a new note', () => {
    const onAddNote = vi.fn();

    render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={onAddNote}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'notes' }}
        onSetRevealed={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText('Add a note...');
    fireEvent.change(textarea, { target: { value: 'My new note' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onAddNote).toHaveBeenCalledWith('t1', 'My new note');
  });

  it('should call onDeleteNote when deleting a note', () => {
    const onDeleteNote = vi.fn();
    const taskWithNotes: Task = {
      ...mockTask,
      notes: [
        { id: 'tn4', text: 'Note to delete', createdAt: '2026-02-12T10:00:00Z' },
      ],
    };

    render(
      <TaskItem
        task={taskWithNotes}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={onDeleteNote}
        onAddSubtask={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'notes' }}
        onSetRevealed={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(onDeleteNote).toHaveBeenCalledWith('t1', 'tn4');
  });

  it('should allow editing a note inline', () => {
    const onEditNote = vi.fn();
    const taskWithNotes: Task = {
      ...mockTask,
      notes: [
        { id: 'tn5', text: 'Original note', createdAt: '2026-02-12T10:00:00Z' },
      ],
    };

    render(
      <TaskItem
        task={taskWithNotes}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={onEditNote}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'notes' }}
        onSetRevealed={vi.fn()}
      />
    );

    // Click edit
    fireEvent.click(screen.getByText('Edit'));

    // Should show textarea with existing text
    const textarea = screen.getByDisplayValue('Original note');
    fireEvent.change(textarea, { target: { value: 'Updated note' } });

    // Save
    fireEvent.click(screen.getAllByText('Save')[0]);

    expect(onEditNote).toHaveBeenCalledWith('t1', 'tn5', 'Updated note');
  });

  // Due date badge tests
  it('should show due date badge for overdue task', () => {
    const overdueTask: Task = {
      ...mockTask,
      dueDate: '2025-01-01',
    };

    render(
      <TaskItem
        task={overdueTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    const badge = screen.getByTestId('due-date-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe('2d overdue');
    expect(badge.className).toContain('text-tokyo-red');
  });

  it('should show due date badge for task due today', () => {
    const todayTask: Task = {
      ...mockTask,
      dueDate: '2025-03-15',
    };

    render(
      <TaskItem
        task={todayTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    const badge = screen.getByTestId('due-date-badge');
    expect(badge.textContent).toBe('today');
    expect(badge.className).toContain('text-tokyo-yellow');
  });

  it('should show due date badge for upcoming task', () => {
    const upcomingTask: Task = {
      ...mockTask,
      dueDate: '2025-03-16',
    };

    render(
      <TaskItem
        task={upcomingTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    const badge = screen.getByTestId('due-date-badge');
    expect(badge.textContent).toBe('tomorrow');
    expect(badge.className).toContain('text-tokyo-cyan');
  });

  it('should not show due date badge for completed task', () => {
    const completedWithDue: Task = {
      ...mockTask,
      completed: true,
      completedAt: '2025-03-10',
      dueDate: '2025-01-01',
    };

    render(
      <TaskItem
        task={completedWithDue}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.queryByTestId('due-date-badge')).not.toBeInTheDocument();
  });

  it('should not show due date badge when dueDate is null', () => {
    render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.queryByTestId('due-date-badge')).not.toBeInTheDocument();
  });

  it('should show set/clear due date buttons in edit panel', () => {
    const onUpdateDueDate = vi.fn();
    const taskWithDue: Task = {
      ...mockTask,
      dueDate: '2025-03-15',
    };

    render(
      <TaskItem
        task={taskWithDue}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        onUpdateDueDate={onUpdateDueDate}
        revealedItem={{ type: 'task', id: 't1', mode: 'edit' }}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('Change due date')).toBeInTheDocument();
    expect(screen.getByText('Clear due date')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear due date'));
    expect(onUpdateDueDate).toHaveBeenCalledWith('t1', null);
  });

  it('should show "Set due date" when task has no due date', () => {
    render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddNote={vi.fn()}
        onEditNote={vi.fn()}
        onDeleteNote={vi.fn()}
        onAddSubtask={vi.fn()}
        onUpdateDueDate={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'edit' }}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('Set due date')).toBeInTheDocument();
    expect(screen.queryByText('Clear due date')).not.toBeInTheDocument();
  });
});
