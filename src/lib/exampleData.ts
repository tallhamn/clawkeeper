import type { Habit, Task } from './types';
import { generateId } from './utils';

/**
 * Example habits shown on first launch
 */
export const EXAMPLE_HABITS: Habit[] = [
  {
    id: generateId(),
    text: 'write code',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 4,
    reflections: [],
  },
  {
    id: generateId(),
    text: 'light workout',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 2,
    reflections: [],
  },
  {
    id: generateId(),
    text: 'real workout',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 24,
    reflections: [],
  },
  {
    id: generateId(),
    text: 'coding challenge',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 8,
    reflections: [],
  },
];

/**
 * Example tasks shown on first launch
 */
export const EXAMPLE_TASKS: Task[] = [
  {
    id: generateId(),
    text: 'Hire VP of Sales',
    completed: false,
    completedAt: null,
    reflections: [],
    children: [
      {
        id: generateId(),
        text: 'Define role requirements and comp range',
        completed: true,
        completedAt: '2025-01-05',
        reflections: [
          'Took longer than expected - should have talked to other founders first to benchmark comp',
        ],
        children: [],
      },
      {
        id: generateId(),
        text: 'Reach out to network for referrals',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [],
      },
      {
        id: generateId(),
        text: 'Contact 3 executive recruiters',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [],
      },
    ],
  },
  {
    id: generateId(),
    text: 'Guest house network infrastructure',
    completed: false,
    completedAt: null,
    reflections: [],
    children: [
      {
        id: generateId(),
        text: 'Order Cat6A burial cable',
        completed: true,
        completedAt: '2025-01-03',
        reflections: ['Monoprice was way cheaper than Amazon, saved $80'],
        children: [],
      },
      {
        id: generateId(),
        text: 'Rent trencher for cable run',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [],
      },
      {
        id: generateId(),
        text: 'Install network rack in utility closet',
        completed: false,
        completedAt: null,
        reflections: [],
        children: [],
      },
    ],
  },
  {
    id: generateId(),
    text: 'Research sparkling wine selections',
    completed: false,
    completedAt: null,
    reflections: [],
    children: [],
  },
  {
    id: generateId(),
    text: 'Fix garage door opener',
    completed: true,
    completedAt: '2025-01-02',
    reflections: [
      'YouTube tutorial made this easy - 20 min fix, didnt need to call repair guy',
    ],
    children: [],
  },
  {
    id: generateId(),
    text: 'Schedule annual HVAC maintenance',
    completed: true,
    completedAt: '2024-12-28',
    reflections: [],
    children: [],
  },
  {
    id: generateId(),
    text: 'Review Q4 investment portfolio',
    completed: true,
    completedAt: '2024-12-20',
    reflections: [
      'Spent too long on this - next time just rebalance to target allocations, dont overthink',
    ],
    children: [],
  },
];
