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

describe('TaskItem Component', () => {
  const mockTask: Task = {
    id: 't1',
    text: 'Test task',
    completed: false,
    completedAt: null,
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
        { text: 'First note', createdAt: '2026-02-12T10:00:00Z' },
        { text: 'Second note', createdAt: '2026-02-12T11:00:00Z' },
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
        { text: 'First note', createdAt: '2026-02-12T10:00:00Z' },
        { text: 'Second note', createdAt: '2026-02-12T11:00:00Z' },
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
        { text: 'Research finding here', createdAt: '2026-02-12T10:00:00Z' },
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
        { text: 'Note to delete', createdAt: '2026-02-12T10:00:00Z' },
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

    expect(onDeleteNote).toHaveBeenCalledWith('t1', 'Note to delete');
  });

  it('should allow editing a note inline', () => {
    const onEditNote = vi.fn();
    const taskWithNotes: Task = {
      ...mockTask,
      notes: [
        { text: 'Original note', createdAt: '2026-02-12T10:00:00Z' },
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

    expect(onEditNote).toHaveBeenCalledWith('t1', 'Original note', 'Updated note');
  });
});
