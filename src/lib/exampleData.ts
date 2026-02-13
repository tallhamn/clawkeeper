import type { Habit, Task } from './types';
import { generateId } from './utils';

/**
 * Example habits shown on first launch
 */
export const EXAMPLE_HABITS: Habit[] = [
  {
    id: generateId(),
    text: 'exercise',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 24,
    notes: [],
  },
  {
    id: generateId(),
    text: 'read',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 24,
    notes: [],
  },
  {
    id: generateId(),
    text: 'cook a real meal',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 24,
    notes: [],
  },
  {
    id: generateId(),
    text: 'go outside',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 12,
    notes: [],
  },
];

/**
 * Example tasks shown on first launch
 */
export const EXAMPLE_TASKS: Task[] = [
  {
    id: generateId(),
    text: 'Plan that trip you keep talking about',
    completed: false,
    completedAt: null,
    notes: [],
    children: [
      {
        id: generateId(),
        text: 'Pick dates (for real this time)',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
      {
        id: generateId(),
        text: 'Book flights before prices get worse',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
      {
        id: generateId(),
        text: 'Find a place to stay',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
    ],
  },
  {
    id: generateId(),
    text: 'Learn to cook something impressive',
    completed: false,
    completedAt: null,
    notes: [],
    children: [
      {
        id: generateId(),
        text: 'Pick a recipe that looks hard but isn\'t',
        completed: true,
        completedAt: '2025-01-04',
        notes: [{ text: 'Went with risotto. Turns out stirring is the whole thing.', createdAt: '2025-01-04T12:00:00Z' }],
        children: [],
      },
      {
        id: generateId(),
        text: 'Buy ingredients',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
      {
        id: generateId(),
        text: 'Actually make it',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
    ],
  },
  {
    id: generateId(),
    text: 'Sort out the closet situation',
    completed: true,
    completedAt: '2025-01-02',
    notes: [{ text: 'Donated 3 bags. Apparently I owned 11 nearly identical grey t-shirts.', createdAt: '2025-01-02T12:00:00Z' }],
    children: [],
  },
  {
    id: generateId(),
    text: 'Cancel subscriptions you forgot about',
    completed: true,
    completedAt: '2024-12-28',
    notes: [{ text: 'Found two meditation apps. The irony was not lost on me.', createdAt: '2024-12-28T12:00:00Z' }],
    children: [],
  },
  {
    id: generateId(),
    text: 'Back up photos before your phone decides to die',
    completed: false,
    completedAt: null,
    notes: [],
    children: [],
  },
  {
    id: generateId(),
    text: 'Try asking the AI to help plan your week',
    completed: false,
    completedAt: null,
    notes: [],
    children: [],
  },
];
