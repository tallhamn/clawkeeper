import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TasksSection } from './TasksSection';
import type { Task } from '@/lib/types';

describe('TasksSection', () => {
  const mockTasks: Task[] = [
    {
      id: 't1',
      text: 'Task 1',
      completed: false,
      completedAt: null,
      reflections: [],
      children: [],
    },
    {
      id: 't2',
      text: 'Completed Task',
      completed: true,
      completedAt: '2026-01-08',
      reflections: [],
      children: [],
    },
  ];

  const defaultProps = {
    tasks: mockTasks,
    searchQuery: '',
    showCompleted: false,
    onToggle: vi.fn(),
    onAddReflection: vi.fn(),
    onAddSubtask: vi.fn(),
    onAddTask: vi.fn(),
    onDelete: vi.fn(),
    onUpdateText: vi.fn(),
    revealedItem: null,
    onSetRevealed: vi.fn(),
    onToggleShowCompleted: vi.fn(),
  };

  it('should show incomplete tasks by default', () => {
    render(<TasksSection {...defaultProps} />);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
  });

  it('should show completed tasks when showCompleted is true', () => {
    render(<TasksSection {...defaultProps} showCompleted={true} />);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Completed Task')).toBeInTheDocument();
  });

  it('should keep unchecked task visible after unchecking', () => {
    // Start with a completed task
    const completedTask: Task = {
      id: 't1',
      text: 'Recently Completed Task',
      completed: true,
      completedAt: '2026-01-08',
      reflections: [],
      children: [],
    };

    const { rerender } = render(
      <TasksSection
        {...defaultProps}
        tasks={[completedTask]}
        showCompleted={true}
      />
    );

    // Task should be visible when showCompleted is true
    expect(screen.getByText('Recently Completed Task')).toBeInTheDocument();

    // Now simulate unchecking the task (marking as not done)
    const uncheckedTask: Task = {
      ...completedTask,
      completed: false,
      completedAt: null,  // This is set to null when unchecked
    };

    // Rerender with showCompleted = false (default view)
    rerender(
      <TasksSection
        {...defaultProps}
        tasks={[uncheckedTask]}
        showCompleted={false}
      />
    );

    // The unchecked task should STILL be visible because it's now incomplete
    expect(screen.getByText('Recently Completed Task')).toBeInTheDocument();
  });

  it('should show parent task if it has incomplete children', () => {
    const parentWithIncompleteChild: Task = {
      id: 'parent',
      text: 'Parent Task',
      completed: true,
      completedAt: '2026-01-08',
      reflections: [],
      children: [
        {
          id: 'child',
          text: 'Incomplete Child',
          completed: false,
          completedAt: null,
          reflections: [],
          children: [],
        },
      ],
    };

    render(
      <TasksSection
        {...defaultProps}
        tasks={[parentWithIncompleteChild]}
        showCompleted={false}
      />
    );

    // Parent should be visible because it has incomplete children
    expect(screen.getByText('Parent Task')).toBeInTheDocument();
    expect(screen.getByText('Incomplete Child')).toBeInTheDocument();
  });

  it('should filter task after unchecking when completedAt from previous month', () => {
    // This is an edge case: task completed in previous month, then unchecked
    const oldCompletedTask: Task = {
      id: 't1',
      text: 'Old Task',
      completed: true,
      completedAt: '2025-12-15', // Previous month
      reflections: [],
      children: [],
    };

    const { rerender } = render(
      <TasksSection
        {...defaultProps}
        tasks={[oldCompletedTask]}
        showCompleted={true}
      />
    );

    // Initially not visible because it's from previous month (filtered by storage layer)
    // But let's test what happens if it somehow makes it to the UI

    // Uncheck it
    const uncheckedOldTask: Task = {
      ...oldCompletedTask,
      completed: false,
      completedAt: null,
    };

    rerender(
      <TasksSection
        {...defaultProps}
        tasks={[uncheckedOldTask]}
        showCompleted={false}
      />
    );

    // Should be visible now because it's incomplete
    expect(screen.getByText('Old Task')).toBeInTheDocument();
  });
});
