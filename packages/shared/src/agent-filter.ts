import type { AppState, Habit, Task } from './types';

/**
 * Filter state to only include habits and tasks assigned to a specific agent.
 * Subtasks inherit agentId from their parent (root task).
 */
export function filterByAgent(state: AppState, agentId: string): AppState {
  const habits = state.habits.filter(h => h.agentId === agentId);
  const tasks = state.tasks.filter(t => t.agentId === agentId);
  return { habits, tasks };
}

/**
 * Remove all references to a specific agent from habits and tasks.
 * Returns the updated state and the count of items that were unassigned.
 */
export function removeAgentReferences(state: AppState, agentId: string): { state: AppState; unassignedCount: number } {
  let count = 0;

  const habits: Habit[] = state.habits.map(h => {
    if (h.agentId === agentId) {
      count++;
      const { agentId: _, ...rest } = h;
      return rest as Habit;
    }
    return h;
  });

  function clearAgentFromTasks(tasks: Task[]): Task[] {
    return tasks.map(t => {
      const children = clearAgentFromTasks(t.children);
      if (t.agentId === agentId) {
        count++;
        const { agentId: _, ...rest } = t;
        return { ...rest, children } as Task;
      }
      return { ...t, children };
    });
  }

  const tasks = clearAgentFromTasks(state.tasks);

  return { state: { habits, tasks }, unassignedCount: count };
}
