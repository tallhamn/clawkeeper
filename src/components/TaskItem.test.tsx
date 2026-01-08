import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskItem } from './TaskItem';
import type { Task } from '@/lib/types';

describe('TaskItem Component', () => {
  const mockTask: Task = {
    id: 't1',
    text: 'Test task',
    completed: false,
    completedAt: null,
    reflections: [],
    children: [],
  };

  it('should render task text', () => {
    render(
      <TaskItem
        task={mockTask}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddReflection={vi.fn()}
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
        onAddReflection={vi.fn()}
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
        onAddReflection={vi.fn()}
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
        onAddReflection={vi.fn()}
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
        onAddReflection={vi.fn()}
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
          reflections: [],
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
        onAddReflection={vi.fn()}
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
        onAddReflection={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={null}
        onSetRevealed={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should display multiple reflections', () => {
    const taskWithReflections: Task = {
      ...mockTask,
      reflections: ['First reflection', 'Second reflection'],
    };

    render(
      <TaskItem
        task={taskWithReflections}
        depth={0}
        showCompleted={true}
        onToggle={vi.fn()}
        onAddReflection={vi.fn()}
        onAddSubtask={vi.fn()}
        revealedItem={{ type: 'task', id: 't1', mode: 'view-reflections' }}
        onSetRevealed={vi.fn()}
      />
    );

    expect(screen.getByText('First reflection')).toBeInTheDocument();
    expect(screen.getByText('Second reflection')).toBeInTheDocument();
  });
});
