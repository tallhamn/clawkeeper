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
    notes: [],
  },
  {
    id: generateId(),
    text: 'light workout',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 2,
    notes: [],
  },
  {
    id: generateId(),
    text: 'real workout',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 24,
    notes: [],
  },
  {
    id: generateId(),
    text: 'coding challenge',
    totalCompletions: 0,
    lastCompleted: null,
    repeatIntervalHours: 8,
    notes: [],
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
    notes: [],
    children: [
      {
        id: generateId(),
        text: 'Define role requirements and comp range',
        completed: true,
        completedAt: '2025-01-05',
        notes: [{ text: 'Took longer than expected - should have talked to other founders first to benchmark comp', createdAt: '2025-01-05T12:00:00Z' }],
        children: [],
      },
      {
        id: generateId(),
        text: 'Reach out to network for referrals',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
      {
        id: generateId(),
        text: 'Contact 3 executive recruiters',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
    ],
  },
  {
    id: generateId(),
    text: 'Guest house network infrastructure',
    completed: false,
    completedAt: null,
    notes: [],
    children: [
      {
        id: generateId(),
        text: 'Order Cat6A burial cable',
        completed: true,
        completedAt: '2025-01-03',
        notes: [{ text: 'Monoprice was way cheaper than Amazon, saved $80', createdAt: '2025-01-03T12:00:00Z' }],
        children: [],
      },
      {
        id: generateId(),
        text: 'Rent trencher for cable run',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
      {
        id: generateId(),
        text: 'Install network rack in utility closet',
        completed: false,
        completedAt: null,
        notes: [],
        children: [],
      },
    ],
  },
  {
    id: generateId(),
    text: 'Research sparkling wine selections',
    completed: false,
    completedAt: null,
    notes: [],
    children: [],
  },
  {
    id: generateId(),
    text: 'Fix garage door opener',
    completed: true,
    completedAt: '2025-01-02',
    notes: [{ text: 'YouTube tutorial made this easy - 20 min fix, didnt need to call repair guy', createdAt: '2025-01-02T12:00:00Z' }],
    children: [],
  },
  {
    id: generateId(),
    text: 'Schedule annual HVAC maintenance',
    completed: true,
    completedAt: '2024-12-28',
    notes: [],
    children: [],
  },
  {
    id: generateId(),
    text: 'Review Q4 investment portfolio',
    completed: true,
    completedAt: '2024-12-20',
    notes: [{ text: 'Spent too long on this - next time just rebalance to target allocations, dont overthink', createdAt: '2024-12-20T12:00:00Z' }],
    children: [],
  },
];
