import React, { useState, useEffect, useRef } from 'react';

const generateId = () => Math.random().toString(36).substr(2, 9);

// === MARKDOWN SERIALIZATION ===

const serializeToMarkdown = (habits, tasks) => {
  let md = '# Habits\n\n';
  
  habits.forEach(habit => {
    md += `## ${habit.text}\n`;
    md += `- Window: ${habit.timeWindow}\n`;
    md += `- Streak: ${habit.streak}\n`;
    md += `- Completed today: ${habit.completedToday ? 'yes' : 'no'}\n`;
    if (habit.reflections && habit.reflections.length > 0) {
      md += `- Reflections:\n`;
      habit.reflections.forEach(r => {
        md += `  - ${r}\n`;
      });
    }
    md += '\n';
  });
  
  md += '---\n\n# Tasks\n\n';
  
  const serializeTask = (task, depth = 0) => {
    const indent = '  '.repeat(depth);
    const checkbox = task.completed ? '[x]' : '[ ]';
    const completedDate = task.completedAt ? ` (${task.completedAt})` : '';
    md += `${indent}- ${checkbox} ${task.text}${completedDate}\n`;
    if (task.reflection) {
      md += `${indent}  > ${task.reflection}\n`;
    }
    if (task.children) {
      task.children.forEach(child => serializeTask(child, depth + 1));
    }
  };
  
  tasks.forEach(task => {
    md += `## ${task.text}\n`;
    if (task.completed) {
      md += `- Status: completed${task.completedAt ? ` (${task.completedAt})` : ''}\n`;
    }
    if (task.reflection) {
      md += `> ${task.reflection}\n`;
    }
    if (task.children && task.children.length > 0) {
      task.children.forEach(child => serializeTask(child, 0));
    }
    md += '\n';
  });
  
  return md;
};

const parseMarkdown = (md) => {
  const habits = [];
  const tasks = [];
  
  const lines = md.split('\n');
  let currentSection = null; // 'habits' or 'tasks'
  let currentItem = null;
  let currentTask = null;
  let taskStack = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === '# Habits') {
      currentSection = 'habits';
      continue;
    }
    if (line === '# Tasks') {
      currentSection = 'tasks';
      continue;
    }
    if (line === '---') continue;
    
    if (currentSection === 'habits') {
      if (line.startsWith('## ')) {
        if (currentItem) habits.push(currentItem);
        currentItem = {
          id: generateId(),
          text: line.slice(3),
          timeWindow: 'morning',
          streak: 0,
          completedToday: false,
          reflections: []
        };
      } else if (currentItem) {
        if (line.startsWith('- Window: ')) {
          currentItem.timeWindow = line.slice(10);
        } else if (line.startsWith('- Streak: ')) {
          currentItem.streak = parseInt(line.slice(10)) || 0;
        } else if (line.startsWith('- Completed today: ')) {
          currentItem.completedToday = line.slice(19) === 'yes';
        } else if (line.startsWith('  - ') && lines[i-1]?.includes('Reflections')) {
          currentItem.reflections.push(line.slice(4));
        } else if (line.startsWith('  - ')) {
          currentItem.reflections.push(line.slice(4));
        }
      }
    }
    
    if (currentSection === 'tasks') {
      if (line.startsWith('## ')) {
        if (currentTask) tasks.push(currentTask);
        currentTask = {
          id: generateId(),
          text: line.slice(3),
          completed: false,
          completedAt: null,
          reflection: null,
          children: []
        };
        taskStack = [currentTask];
      } else if (currentTask) {
        if (line.startsWith('- Status: completed')) {
          currentTask.completed = true;
          const dateMatch = line.match(/\((\d{4}-\d{2}-\d{2})\)/);
          if (dateMatch) currentTask.completedAt = dateMatch[1];
        } else if (line.startsWith('> ') && taskStack.length === 1) {
          currentTask.reflection = line.slice(2);
        } else if (line.match(/^(\s*)- \[(x| )\] /)) {
          const match = line.match(/^(\s*)- \[(x| )\] (.+?)(?:\s+\((\d{4}-\d{2}-\d{2})\))?$/);
          if (match) {
            const depth = match[1].length / 2;
            const completed = match[2] === 'x';
            const text = match[3];
            const completedAt = match[4] || null;
            
            const newTask = {
              id: generateId(),
              text,
              completed,
              completedAt,
              reflection: null,
              children: []
            };
            
            // Adjust stack to correct depth
            while (taskStack.length > depth + 1) {
              taskStack.pop();
            }
            
            const parent = taskStack[taskStack.length - 1];
            parent.children.push(newTask);
            taskStack.push(newTask);
          }
        } else if (line.match(/^\s*> /)) {
          // Reflection for a subtask
          const reflection = line.trim().slice(2);
          if (taskStack.length > 1) {
            taskStack[taskStack.length - 1].reflection = reflection;
          }
        }
      }
    }
  }
  
  // Push final items
  if (currentSection === 'habits' && currentItem) {
    habits.push(currentItem);
  }
  if (currentSection === 'tasks' && currentTask) {
    tasks.push(currentTask);
  }
  
  return { habits, tasks };
};

// === HISTORY MANAGEMENT ===

const saveSnapshot = (habits, tasks, reason = 'auto') => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshot = {
    timestamp,
    reason,
    markdown: serializeToMarkdown(habits, tasks),
    data: { habits, tasks }
  };
  
  // Get existing history from localStorage (simulating file system)
  const history = JSON.parse(localStorage.getItem('habits-app-history') || '[]');
  history.unshift(snapshot);
  
  // Keep only last 20 snapshots
  const trimmedHistory = history.slice(0, 20);
  localStorage.setItem('habits-app-history', JSON.stringify(trimmedHistory));
  
  return snapshot;
};

const getHistory = () => {
  return JSON.parse(localStorage.getItem('habits-app-history') || '[]');
};

const saveCurrentState = (habits, tasks) => {
  const markdown = serializeToMarkdown(habits, tasks);
  localStorage.setItem('habits-app-current', markdown);
  localStorage.setItem('habits-app-data', JSON.stringify({ habits, tasks }));
};

const loadCurrentState = () => {
  const data = localStorage.getItem('habits-app-data');
  if (data) {
    return JSON.parse(data);
  }
  return null;
};

const TIME_WINDOWS = {
  morning: { label: 'Morning', start: 6, end: 11, icon: '🌅' },
  midday: { label: 'Midday', start: 11, end: 14, icon: '☀️' },
  afternoon: { label: 'Afternoon', start: 14, end: 17, icon: '🌤' },
  evening: { label: 'Evening', start: 17, end: 21, icon: '🌆' },
  night: { label: 'Night', start: 21, end: 24, icon: '🌙' },
};

const getCurrentWindow = (hour) => {
  for (const [key, window] of Object.entries(TIME_WINDOWS)) {
    if (hour >= window.start && hour < window.end) return key;
  }
  return 'morning';
};

const getRelativeTime = (windowKey, currentHour, completedToday) => {
  if (completedToday) return null;
  const window = TIME_WINDOWS[windowKey];
  if (currentHour < window.start) {
    const hoursUntil = window.start - currentHour;
    if (hoursUntil <= 1) return { text: 'coming up', state: 'upcoming' };
    if (hoursUntil <= 3) return { text: `~${Math.round(hoursUntil)}h away`, state: 'upcoming' };
    return { text: 'later', state: 'future' };
  } else if (currentHour >= window.start && currentHour < window.end) {
    return { text: 'now', state: 'current' };
  } else {
    const hoursPast = currentHour - window.end;
    if (hoursPast <= 2) return { text: 'still open', state: 'past' };
    return { text: 'earlier', state: 'past' };
  }
};

const initialHabits = [
  { id: generateId(), text: 'Morning workout', streak: 12, completedToday: false, timeWindow: 'morning', reflections: ['Felt sluggish but pushed through - always feel better after', 'Tried new HIIT routine, way more efficient'] },
  { id: generateId(), text: 'Review daily goals', streak: 5, completedToday: true, timeWindow: 'morning', reflections: ['Keeping it to 3 priorities max works best'] },
  { id: generateId(), text: 'Focused coding block', streak: 8, completedToday: false, timeWindow: 'midday', reflections: ['Phone in other room = 2x productivity', 'Music helps, podcasts distract'] },
  { id: generateId(), text: 'Walk the property', streak: 3, completedToday: false, timeWindow: 'afternoon', reflections: [] },
  { id: generateId(), text: 'Evening wind-down', streak: 22, completedToday: false, timeWindow: 'evening', reflections: ['No screens after 9pm is game changer for sleep'] },
];

const initialTasks = [
  {
    id: generateId(),
    text: 'Hire VP of Sales',
    completed: false,
    completedAt: null,
    reflection: null,
    children: [
      { id: generateId(), text: 'Define role requirements and comp range', completed: true, completedAt: '2025-01-05', reflection: 'Took longer than expected - should have talked to other founders first to benchmark comp', children: [] },
      { id: generateId(), text: 'Reach out to network for referrals', completed: false, completedAt: null, reflection: null, children: [] },
      { id: generateId(), text: 'Contact 3 executive recruiters', completed: false, completedAt: null, reflection: null, children: [] },
    ]
  },
  {
    id: generateId(),
    text: 'Guest house network infrastructure',
    completed: false,
    completedAt: null,
    reflection: null,
    children: [
      { id: generateId(), text: 'Order Cat6A burial cable', completed: true, completedAt: '2025-01-03', reflection: 'Monoprice was way cheaper than Amazon, saved $80', children: [] },
      { id: generateId(), text: 'Rent trencher for cable run', completed: false, completedAt: null, reflection: null, children: [] },
      { id: generateId(), text: 'Install network rack in utility closet', completed: false, completedAt: null, reflection: null, children: [] },
    ]
  },
  {
    id: generateId(),
    text: 'Research sparkling wine selections',
    completed: false,
    completedAt: null,
    reflection: null,
    children: []
  },
  {
    id: generateId(),
    text: 'Fix garage door opener',
    completed: true,
    completedAt: '2025-01-02',
    reflection: 'YouTube tutorial made this easy - 20 min fix, didnt need to call repair guy',
    children: []
  },
  {
    id: generateId(),
    text: 'Schedule annual HVAC maintenance',
    completed: true,
    completedAt: '2024-12-28',
    reflection: null,
    children: []
  },
  {
    id: generateId(),
    text: 'Review Q4 investment portfolio',
    completed: true,
    completedAt: '2024-12-20',
    reflection: 'Spent too long on this - next time just rebalance to target allocations, dont overthink',
    children: []
  },
];

// LLM-powered task filter interpreter
const interpretTaskFilter = async (query, tasks) => {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const queryLower = query.toLowerCase();
  
  // Flatten tasks for searching
  const flattenTasks = (tasks, parent = null, parentId = null) => {
    let result = [];
    for (const task of tasks) {
      result.push({ ...task, parent, parentId });
      if (task.children) {
        result = result.concat(flattenTasks(task.children, task.text, task.id));
      }
    }
    return result;
  };
  const allTasks = flattenTasks(tasks);
  
  // Check for reflection/learnings queries
  if (queryLower.includes('reflection') || queryLower.includes('learning') || queryLower.includes('insight') || queryLower.includes('what worked') || queryLower.includes('lessons')) {
    const withReflections = allTasks.filter(t => t.reflection);
    return {
      tasks: withReflections,
      groupedTasks: null,
      description: `Tasks with reflections (${withReflections.length} learnings)`,
      count: withReflections.length,
      showReflections: true
    };
  }
  
  // Interpret the query
  let filtered = allTasks;
  let description = '';
  
  // Status filters
  if (queryLower.includes('done') || queryLower.includes('completed') || queryLower.includes('finished')) {
    filtered = filtered.filter(t => t.completed);
    description = 'Completed tasks';
  } else if (queryLower.includes('open') || queryLower.includes('incomplete') || queryLower.includes('todo') || queryLower.includes('remaining')) {
    filtered = filtered.filter(t => !t.completed);
    description = 'Open tasks';
  }
  
  // Time filters
  const now = new Date('2025-01-07');
  if (queryLower.includes('today')) {
    filtered = filtered.filter(t => t.completedAt === '2025-01-07');
    description = 'Completed today';
  } else if (queryLower.includes('yesterday')) {
    filtered = filtered.filter(t => t.completedAt === '2025-01-06');
    description = 'Completed yesterday';
  } else if (queryLower.includes('this week') || queryLower.includes('last 7') || queryLower.includes('past week')) {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = filtered.filter(t => {
      if (!t.completedAt) return false;
      const d = new Date(t.completedAt);
      return d >= weekAgo && d <= now;
    });
    description = 'Completed this week';
  } else if (queryLower.includes('last month') || queryLower.includes('this month') || queryLower.includes('december')) {
    filtered = filtered.filter(t => {
      if (!t.completedAt) return false;
      return t.completedAt.startsWith('2024-12') || t.completedAt.startsWith('2025-01');
    });
    description = 'Completed recently';
  }
  
  // Topic filters - find matching top-level tasks and include all their children
  let topicMatch = false;
  let matchingParentIds = new Set();
  
  if (queryLower.includes('hire') || queryLower.includes('hiring') || queryLower.includes('vp') || queryLower.includes('sales')) {
    // Find top-level tasks that match
    tasks.forEach(t => {
      if (t.text.toLowerCase().includes('hire') || 
          t.text.toLowerCase().includes('vp') || 
          t.text.toLowerCase().includes('sales')) {
        matchingParentIds.add(t.id);
      }
    });
    // Also include tasks where subtasks match
    filtered.forEach(t => {
      if (t.text.toLowerCase().includes('hire') || 
          t.text.toLowerCase().includes('recruiter') ||
          t.text.toLowerCase().includes('role') ||
          t.text.toLowerCase().includes('referral')) {
        if (t.parentId) matchingParentIds.add(t.parentId);
      }
    });
    description = description ? `${description} related to hiring` : 'Hiring tasks';
    topicMatch = true;
  } else if (queryLower.includes('guest house') || queryLower.includes('network') || queryLower.includes('cable') || queryLower.includes('infrastructure')) {
    tasks.forEach(t => {
      if (t.text.toLowerCase().includes('network') || 
          t.text.toLowerCase().includes('guest house') ||
          t.text.toLowerCase().includes('infrastructure')) {
        matchingParentIds.add(t.id);
      }
    });
    filtered.forEach(t => {
      if (t.text.toLowerCase().includes('cable') || 
          t.text.toLowerCase().includes('trencher') ||
          t.text.toLowerCase().includes('rack')) {
        if (t.parentId) matchingParentIds.add(t.parentId);
      }
    });
    description = description ? `${description} related to guest house/network` : 'Guest house & network tasks';
    topicMatch = true;
  } else if (queryLower.includes('wine') || queryLower.includes('sparkling')) {
    tasks.forEach(t => {
      if (t.text.toLowerCase().includes('wine') || 
          t.text.toLowerCase().includes('sparkling')) {
        matchingParentIds.add(t.id);
      }
    });
    description = description ? `${description} related to wine` : 'Wine tasks';
    topicMatch = true;
  } else if (queryLower.includes('house') || queryLower.includes('home') || queryLower.includes('maintenance')) {
    tasks.forEach(t => {
      if (t.text.toLowerCase().includes('house') || 
          t.text.toLowerCase().includes('garage') || 
          t.text.toLowerCase().includes('hvac') ||
          t.text.toLowerCase().includes('maintenance')) {
        matchingParentIds.add(t.id);
      }
    });
    description = description ? `${description} related to home` : 'Home & maintenance tasks';
    topicMatch = true;
  }
  
  // If topic match, return grouped results
  if (topicMatch && matchingParentIds.size > 0) {
    const groupedTasks = tasks.filter(t => matchingParentIds.has(t.id));
    return {
      tasks: filtered,
      groupedTasks: groupedTasks,
      description,
      count: groupedTasks.length + groupedTasks.reduce((sum, t) => sum + (t.children?.length || 0), 0)
    };
  }
  
  // "All" or "everything" shows all
  if (queryLower.includes('all') || queryLower.includes('everything')) {
    return {
      tasks: allTasks,
      groupedTasks: tasks, // Show hierarchical
      description: 'All tasks',
      count: allTasks.length
    };
  }
  
  if (!description) {
    // Generic text search - also try to group
    const words = queryLower.split(' ').filter(w => w.length > 2);
    if (words.length > 0) {
      // Find matching parent tasks
      tasks.forEach(t => {
        if (words.some(w => t.text.toLowerCase().includes(w))) {
          matchingParentIds.add(t.id);
        }
        // Check children too
        t.children?.forEach(c => {
          if (words.some(w => c.text.toLowerCase().includes(w))) {
            matchingParentIds.add(t.id);
          }
        });
      });
      
      if (matchingParentIds.size > 0) {
        const groupedTasks = tasks.filter(t => matchingParentIds.has(t.id));
        return {
          tasks: allTasks.filter(t => words.some(w => t.text.toLowerCase().includes(w))),
          groupedTasks,
          description: `Tasks matching "${query}"`,
          count: groupedTasks.length + groupedTasks.reduce((sum, t) => sum + (t.children?.length || 0), 0)
        };
      }
      
      filtered = allTasks.filter(t => 
        words.some(w => t.text.toLowerCase().includes(w))
      );
      description = `Tasks matching "${query}"`;
    }
  }
  
  return {
    tasks: filtered,
    groupedTasks: null,
    description: description || `Results for "${query}"`,
    count: filtered.length
  };
};

// Simulated LLM responses based on context
const generateAssistantResponse = async (message, habits, tasks, currentHour) => {
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
  
  const messageLower = message.toLowerCase();
  const currentWindow = getCurrentWindow(currentHour);
  const incompleteHabits = habits.filter(h => !h.completedToday);
  const currentHabits = habits.filter(h => h.timeWindow === currentWindow && !h.completedToday);
  
  // Flatten tasks for analysis
  const flattenTasks = (tasks, depth = 0) => {
    let result = [];
    for (const task of tasks) {
      result.push({ ...task, depth });
      if (task.children) {
        result = result.concat(flattenTasks(task.children, depth + 1));
      }
    }
    return result;
  };
  const allTasks = flattenTasks(tasks);
  const incompleteTasks = allTasks.filter(t => !t.completed);
  const completedToday = habits.filter(h => h.completedToday).length;
  
  // Gather all reflections for context
  const tasksWithReflections = allTasks.filter(t => t.reflection);
  const habitsWithReflections = habits.filter(h => h.reflections && h.reflections.length > 0);
  const totalReflections = tasksWithReflections.length + habitsWithReflections.reduce((sum, h) => sum + h.reflections.length, 0);
  
  // Check for reflection/learning queries
  if (messageLower.includes('reflection') || messageLower.includes('learning') || messageLower.includes('insight') || messageLower.includes('what worked') || messageLower.includes('lessons') || messageLower.includes('what have i learned')) {
    if (totalReflections === 0) {
      return {
        text: `You don't have any reflections yet. When you complete tasks or habits, you can add notes about what worked or what you'd do differently. These build up over time into a personal knowledge base.`,
        actions: null
      };
    }
    
    let response = '**Your reflections:**\n\n';
    
    if (habitsWithReflections.length > 0) {
      response += '**Habits:**\n';
      habitsWithReflections.forEach(h => {
        response += `• **${h.text}:**\n`;
        h.reflections.forEach(r => {
          response += `  - "${r}"\n`;
        });
      });
      response += '\n';
    }
    
    if (tasksWithReflections.length > 0) {
      response += '**Tasks:**\n';
      tasksWithReflections.forEach(t => {
        response += `• **${t.text}**: "${t.reflection}"\n`;
      });
      response += '\n';
    }
    
    response += '**Patterns I notice:**\n';
    response += '• Environment matters (phone away, no screens)\n';
    response += '• DIY often easier than expected with YouTube\n';
    response += '• Talking to others first saves research time\n';
    response += '• Simpler approaches tend to work better';
    
    return {
      text: response,
      actions: null
    };
  }

  // Context-aware responses
  if (messageLower.includes('prioritize') || messageLower.includes('what should i') || messageLower.includes('focus on') || messageLower.includes('most important')) {
    const topTask = incompleteTasks.find(t => t.depth === 0);
    const nextSubtask = incompleteTasks.find(t => t.depth > 0);
    
    return {
      text: `Looking at your list, I'd suggest focusing on "${nextSubtask?.text || topTask?.text}" next. It's a concrete action you can complete, and it moves the bigger goal forward.\n\nFor habits, ${currentHabits.length > 0 ? `"${currentHabits[0].text}" is in your current window — might be worth knocking that out ${currentHabits[0].streak > 5 ? `to keep your ${currentHabits[0].streak}-day streak going` : 'first'}.` : `you've got ${completedToday}/${habits.length} done so far today.`}`,
      actions: null
    };
  }

  if (messageLower.includes('stuck') || messageLower.includes('blocked') || messageLower.includes('help with')) {
    return {
      text: `When you're stuck, it often helps to break it down further or timebox it. What specifically is blocking you? Is it:\n\n• **Unclear next step** — we can break it down more\n• **Waiting on someone** — let's add a follow-up task\n• **Motivation** — maybe tackle a quick win first\n• **Knowledge gap** — what do you need to learn?`,
      actions: null
    };
  }

  if (messageLower.includes('recruiter') || messageLower.includes('hiring')) {
    // Check for relevant reflections
    const hiringReflections = tasksWithReflections.filter(t => 
      t.text.toLowerCase().includes('hire') || 
      t.text.toLowerCase().includes('role') ||
      t.text.toLowerCase().includes('recruit')
    );
    
    let reflectionNote = '';
    if (hiringReflections.length > 0) {
      reflectionNote = `\n\n**From your past reflections:**\n"${hiringReflections[0].reflection}"`;
    }
    
    return {
      text: `For the VP Sales search, a few thoughts:\n\n**On recruiters:** Expect 20-25% of first-year OTE. For a $300k OTE role, that's $60-75k. Worth it if you need speed or don't have a strong network in sales leadership.\n\n**Alternative:** Your network referrals task is still open. Warm intros have much higher conversion. Maybe spend 30 minutes listing 10 people who might know great candidates before committing to recruiter fees?${reflectionNote}\n\nWant me to add a subtask for the network outreach?`,
      actions: [
        { type: 'add_subtask', parentText: 'Hire VP of Sales', text: 'List 10 people who might know VP Sales candidates' }
      ]
    };
  }

  if (messageLower.includes('network') && (messageLower.includes('guest house') || messageLower.includes('cable') || messageLower.includes('infrastructure'))) {
    return {
      text: `For the guest house network:\n\n**Current status:** Cable ordered ✓, trencher and rack install remaining.\n\n**Suggested sequence:**\n1. Rent trencher (need good weather)\n2. Run the cable burial (half-day job)\n3. Then rack install (indoor, weather-independent)\n\nThe cable run is the bottleneck — everything else can happen after. Want me to add a "check weather forecast" task so you can plan the trenching day?`,
      actions: [
        { type: 'add_subtask', parentText: 'Guest house network infrastructure', text: 'Check weather forecast for cable burial day' }
      ]
    };
  }

  if (messageLower.includes('done') || messageLower.includes('finished') || messageLower.includes('completed')) {
    const taskMatch = incompleteTasks.find(t => 
      messageLower.includes(t.text.toLowerCase().split(' ').slice(0, 3).join(' '))
    );
    if (taskMatch) {
      return {
        text: `Nice! I'll mark "${taskMatch.text}" as complete. ${taskMatch.depth === 0 ? "That's a top-level task — solid progress." : "One step closer on the parent goal."}`,
        actions: [{ type: 'complete_task', taskText: taskMatch.text }]
      };
    }
  }

  if (messageLower.includes('today') || messageLower.includes('overview') || messageLower.includes('what do i have')) {
    return {
      text: `**Today's overview:**\n\n**Habits:** ${completedToday}/${habits.length} complete${currentHabits.length > 0 ? `. "${currentHabits[0].text}" is up now.` : '.'}\n\n**Tasks:** ${incompleteTasks.filter(t => t.depth === 0).length} active projects with ${incompleteTasks.filter(t => t.depth > 0).length} subtasks remaining.\n\nYour biggest open items are "${tasks.find(t => !t.completed)?.text}" and the guest house network work. Both have clear next actions defined.`,
      actions: null
    };
  }

  if (messageLower.includes('add') || messageLower.includes('create') || messageLower.includes('new task')) {
    const match = message.match(/["""]([^"""]+)["""]/);
    if (match) {
      return {
        text: `I'll add "${match[1]}" to your tasks. Should this be a standalone task or a subtask under one of your existing projects?`,
        actions: [{ type: 'add_task', text: match[1] }]
      };
    }
    return {
      text: `Sure, what task would you like to add? You can tell me the name and I'll create it. If it should be under an existing project, just let me know which one.`,
      actions: null
    };
  }

  if (messageLower.includes('wine') || messageLower.includes('sparkling')) {
    return {
      text: `For sparkling wine research, a few directions depending on what you're after:\n\n**Champagne** — Grower producers (look for "RM" on label) often better value than big houses. Laherte, Larmandier-Bernier, Pierre Gimonnet.\n\n**Crémant** — French but not Champagne. Crémant de Loire and Crémant de Bourgogne can be excellent at half the price.\n\n**American** — Schramsberg, Roederer Estate, Argyle from Oregon.\n\nWant me to break this down into subtasks for researching each category?`,
      actions: [
        { type: 'add_subtask', parentText: 'Research sparkling wine selections', text: 'Research grower Champagne options' },
        { type: 'add_subtask', parentText: 'Research sparkling wine selections', text: 'Look into Crémant alternatives' },
        { type: 'add_subtask', parentText: 'Research sparkling wine selections', text: 'Check American sparkling options' },
      ]
    };
  }

  // Default response
  return {
    text: `I can help you plan and prioritize. Try asking me:\n\n• "What should I prioritize today?"\n• "I'm stuck on the hiring task"\n• "Help me break down the wine research"\n• "What have I learned?" (reviews your reflections)\n\nI have context on your ${habits.length} habits, ${tasks.length} projects${totalReflections > 0 ? `, and ${totalReflections} reflections` : ''}.`,
    actions: null
  };
};

function ChatPanel({ isOpen, onClose, habits, tasks, currentHour, onAction }) {
  const [messages, setMessages] = useState([
    { id: '1', role: 'assistant', text: `I can see your ${habits.length} habits and ${tasks.length} projects. What would you like to work on?` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage = { id: generateId(), role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const response = await generateAssistantResponse(input, habits, tasks, currentHour);
    
    setIsTyping(false);
    setMessages(prev => [...prev, { 
      id: generateId(), 
      role: 'assistant', 
      text: response.text,
      actions: response.actions 
    }]);
  };

  const handleAction = (action) => {
    onAction(action);
    setMessages(prev => [...prev, { 
      id: generateId(), 
      role: 'system', 
      text: action.type === 'complete_task' ? `✓ Marked "${action.taskText}" complete` : 
            action.type === 'add_task' ? `✓ Added "${action.text}"` :
            action.type === 'add_subtask' ? `✓ Added subtask "${action.text}"` : 'Done'
    }]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-stone-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-stone-800 text-sm">Planning</h3>
            <p className="text-xs text-stone-500">Break down & prioritize</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-stone-400 hover:text-stone-600 hover:bg-white/50 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'system' ? (
              <div className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                {msg.text}
              </div>
            ) : (
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                <div
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-stone-800 text-white rounded-br-md'
                      : 'bg-stone-100 text-stone-800 rounded-bl-md'
                  }`}
                >
                  {msg.text.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-2' : ''}>
                      {line.startsWith('**') && line.endsWith('**') ? (
                        <strong>{line.slice(2, -2)}</strong>
                      ) : line.startsWith('• **') ? (
                        <span>• <strong>{line.slice(4, line.indexOf('**', 4))}</strong>{line.slice(line.indexOf('**', 4) + 2)}</span>
                      ) : (
                        line
                      )}
                    </p>
                  ))}
                </div>
                
                {/* Action buttons */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleAction(action)}
                        className="px-3 py-1.5 text-xs bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {action.type === 'complete_task' ? `Complete "${action.taskText}"` :
                         action.type === 'add_task' ? `Add "${action.text}"` :
                         `Add "${action.text}"`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-stone-200 bg-stone-50">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="What do you want to work on?"
            className="flex-1 px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="px-4 py-2.5 bg-stone-800 text-white rounded-xl hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2 text-center">Try: "Break down the hiring task" or "What should I focus on?"</p>
      </div>
    </div>
  );
}

function AddHabitRow({ onAdd }) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');
  const [timeWindow, setTimeWindow] = useState('morning');

  const handleAdd = () => {
    if (text.trim()) {
      onAdd(text, timeWindow);
      setText('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full px-5 py-2.5 text-left text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-50 border-t border-stone-100 transition-colors"
      >
        + Add habit
      </button>
    );
  }

  return (
    <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setText(''); setIsAdding(false); } }}
          placeholder="New habit..."
          className="flex-1 px-3 py-2 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
          autoFocus
        />
        <button onClick={handleAdd} className="px-4 py-2 text-sm bg-amber-500 text-white rounded-xl hover:bg-amber-600">Add</button>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(TIME_WINDOWS).map(([key, w]) => (
          <button
            key={key}
            onClick={() => setTimeWindow(key)}
            className={`px-2 py-1 text-xs rounded-lg transition-colors ${
              timeWindow === key ? 'bg-amber-500 text-white' : 'bg-white text-stone-500 border border-stone-200 hover:border-amber-300'
            }`}
          >
            {w.icon} {w.label}
          </button>
        ))}
        <button onClick={() => { setText(''); setIsAdding(false); }} className="ml-auto text-xs text-stone-400 hover:text-stone-600">Cancel</button>
      </div>
    </div>
  );
}

function AddTaskRow({ onAdd }) {
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState('');

  const handleAdd = () => {
    if (text.trim()) {
      onAdd(text);
      setText('');
      setIsAdding(false);
    }
  };

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full px-5 py-2.5 text-left text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-50 border-t border-stone-100 transition-colors"
      >
        + Add task
      </button>
    );
  }

  return (
    <div className="px-5 py-3 border-t border-stone-100 bg-stone-50/50">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setText(''); setIsAdding(false); } }}
          placeholder="New task..."
          className="flex-1 px-3 py-2 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
          autoFocus
        />
        <button onClick={handleAdd} className="px-4 py-2 text-sm bg-stone-800 text-white rounded-xl hover:bg-stone-900">Add</button>
        <button onClick={() => { setText(''); setIsAdding(false); }} className="px-3 py-2 text-sm text-stone-400 hover:text-stone-600">Cancel</button>
      </div>
    </div>
  );
}

function HabitItem({ habit, currentHour, onToggle, onDelete, onChangeWindow, onUpdateText, onAddReflection }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(habit.text);
  const [showReflectionInput, setShowReflectionInput] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const window = TIME_WINDOWS[habit.timeWindow];
  const relativeTime = getRelativeTime(habit.timeWindow, currentHour, habit.completedToday);
  const stateStyles = { future: 'opacity-40', upcoming: 'opacity-70', current: '', past: habit.completedToday ? '' : 'opacity-50' };
  const badgeStyles = { future: 'bg-stone-100 text-stone-400', upcoming: 'bg-amber-50 text-amber-600', current: 'bg-emerald-50 text-emerald-600', past: 'bg-stone-100 text-stone-400' };

  const handleSave = () => {
    if (editText.trim()) {
      onUpdateText(habit.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleToggle = () => {
    if (!habit.completedToday) {
      onToggle(habit.id);
      setShowReflectionInput(true);
    } else {
      onToggle(habit.id);
    }
  };

  const handleSaveReflection = () => {
    if (reflectionText.trim()) {
      onAddReflection(habit.id, reflectionText.trim());
    }
    setShowReflectionInput(false);
    setReflectionText('');
  };

  const handleSkipReflection = () => {
    setShowReflectionInput(false);
    setReflectionText('');
  };

  return (
    <div className={`group py-3 ${stateStyles[relativeTime?.state || 'current']}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={handleToggle}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0
            ${habit.completedToday 
              ? 'bg-emerald-500 border-emerald-500 text-white' 
              : 'border-stone-300 hover:border-emerald-400 hover:bg-emerald-50'}`}
        >
          {habit.completedToday && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditText(habit.text); setIsEditing(false); } }}
              className="w-full px-2 py-1 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <span 
                onClick={() => setIsEditing(true)}
                className={`text-sm text-stone-800 cursor-text hover:text-stone-600 ${habit.completedToday ? 'line-through text-stone-400' : ''}`}
              >
                {habit.text}
              </span>
              {relativeTime && !habit.completedToday && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${badgeStyles[relativeTime.state]}`}>{relativeTime.text}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1 mt-0.5">
            <select
              value={habit.timeWindow}
              onChange={(e) => onChangeWindow(habit.id, e.target.value)}
              className="text-xs bg-transparent text-stone-400 cursor-pointer focus:outline-none hover:text-stone-600"
            >
              {Object.entries(TIME_WINDOWS).map(([key, w]) => (
                <option key={key} value={key}>{w.icon} {w.label}</option>
              ))}
            </select>
            {habit.reflections && habit.reflections.length > 0 && (
              <>
                <span className="text-stone-200">·</span>
                <span className="text-xs text-amber-500">{habit.reflections.length} reflection{habit.reflections.length > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>

        {habit.streak > 0 && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-orange-400">🔥</span>
            <span className="text-stone-500 tabular-nums">{habit.streak}</span>
          </div>
        )}

        <button
          onClick={() => onDelete(habit.id)}
          className="p-1.5 text-stone-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Reflection input after completing */}
      {showReflectionInput && (
        <div className="mt-2 ml-8 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-700 mb-2 font-medium">Any reflection? (optional)</p>
          <textarea
            value={reflectionText}
            onChange={(e) => setReflectionText(e.target.value)}
            placeholder="What worked today? Anything to remember?"
            className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={handleSkipReflection}
              className="px-3 py-1 text-xs text-stone-500 hover:text-stone-700"
            >
              Skip
            </button>
            <button
              onClick={handleSaveReflection}
              className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskItem({ task, depth, onToggle, onAddReflection, onAddSubtask, showCompleted }) {
  const [showReflectionInput, setShowReflectionInput] = useState(false);
  const [reflectionText, setReflectionText] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskText, setSubtaskText] = useState('');
  
  const visibleChildren = showCompleted ? task.children : task.children?.filter(child => !child.completed) || [];
  if (!showCompleted && task.completed && visibleChildren.length === 0) return null;

  const depthColors = ['border-l-rose-200', 'border-l-amber-200', 'border-l-emerald-200', 'border-l-sky-200'];

  const handleToggle = () => {
    if (!task.completed) {
      // Completing the task - show reflection prompt
      onToggle(task.id);
      setShowReflectionInput(true);
    } else {
      // Uncompleting
      onToggle(task.id);
    }
  };

  const handleSaveReflection = () => {
    if (reflectionText.trim()) {
      onAddReflection(task.id, reflectionText.trim());
    }
    setShowReflectionInput(false);
    setReflectionText('');
  };

  const handleSkipReflection = () => {
    setShowReflectionInput(false);
    setReflectionText('');
  };

  const handleAddSubtask = () => {
    if (subtaskText.trim() && onAddSubtask) {
      onAddSubtask(task.id, subtaskText.trim());
      setSubtaskText('');
      setShowAddSubtask(false);
    }
  };

  return (
    <div className={`${depth > 0 ? `ml-5 pl-3 border-l-2 ${depthColors[depth % depthColors.length]}` : ''}`}>
      <div className={`group py-2 ${task.completed && !showReflectionInput ? 'opacity-40' : ''}`}>
        <div className="flex items-start gap-2.5">
          <button
            onClick={handleToggle}
            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
              ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-emerald-400'}`}
          >
            {task.completed && (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <div className="flex-1">
            <span className={`text-sm text-stone-700 ${task.completed ? 'line-through text-stone-400' : ''}`}>{task.text}</span>
            {task.reflection && !showReflectionInput && (
              <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                {task.reflection}
              </p>
            )}
          </div>
          {onAddSubtask && !task.completed && (
            <button
              onClick={() => setShowAddSubtask(true)}
              className="p-1 text-stone-300 hover:text-stone-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Add subtask"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Add subtask input */}
        {showAddSubtask && (
          <div className="mt-2 ml-6 flex gap-2">
            <input
              type="text"
              value={subtaskText}
              onChange={(e) => setSubtaskText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(); if (e.key === 'Escape') { setSubtaskText(''); setShowAddSubtask(false); } }}
              placeholder="Subtask..."
              className="flex-1 px-3 py-1.5 text-sm bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-300"
              autoFocus
            />
            <button onClick={handleAddSubtask} className="px-3 py-1.5 text-xs bg-stone-800 text-white rounded-lg">Add</button>
            <button onClick={() => { setSubtaskText(''); setShowAddSubtask(false); }} className="px-2 py-1.5 text-xs text-stone-400 hover:text-stone-600">Cancel</button>
          </div>
        )}
        
        {/* Reflection input after completing */}
        {showReflectionInput && (
          <div className="mt-2 ml-6 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs text-amber-700 mb-2 font-medium">How did it go? (optional)</p>
            <textarea
              value={reflectionText}
              onChange={(e) => setReflectionText(e.target.value)}
              placeholder="What worked? What would you do differently?"
              className="w-full px-3 py-2 text-sm bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              rows={2}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={handleSkipReflection}
                className="px-3 py-1 text-xs text-stone-500 hover:text-stone-700"
              >
                Skip
              </button>
              <button
                onClick={handleSaveReflection}
                className="px-3 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
      {visibleChildren.map(child => (
        <TaskItem key={child.id} task={child} depth={depth + 1} onToggle={onToggle} onAddReflection={onAddReflection} onAddSubtask={onAddSubtask} showCompleted={showCompleted} />
      ))}
    </div>
  );
}

export default function HabitsAndTasks() {
  const [habits, setHabits] = useState(initialHabits);
  const [tasks, setTasks] = useState(initialTasks);
  const [currentHour, setCurrentHour] = useState(10);
  const [chatOpen, setChatOpen] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [coachMessage, setCoachMessage] = useState('');
  const [taskFilter, setTaskFilter] = useState(null); // null = default view (incomplete only)
  const [filterQuery, setFilterQuery] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState(null);
  const [showUndoBar, setShowUndoBar] = useState(false);
  const [lastLLMAction, setLastLLMAction] = useState(null);

  // Auto-save on changes
  useEffect(() => {
    saveCurrentState(habits, tasks);
  }, [habits, tasks]);

  // Load saved state on mount
  useEffect(() => {
    const saved = loadCurrentState();
    if (saved && saved.habits && saved.tasks) {
      // Only load if we have valid data
      if (saved.habits.length > 0 || saved.tasks.length > 0) {
        setHabits(saved.habits);
        setTasks(saved.tasks);
      }
    }
  }, []);

  // Create snapshot before LLM actions
  const createUndoPoint = (reason) => {
    const snapshot = saveSnapshot(habits, tasks, reason);
    setUndoSnapshot(snapshot);
    setShowUndoBar(true);
    // Auto-hide undo bar after 10 seconds
    setTimeout(() => setShowUndoBar(false), 10000);
  };

  // Restore from snapshot
  const handleUndo = () => {
    if (undoSnapshot) {
      setHabits(undoSnapshot.data.habits);
      setTasks(undoSnapshot.data.tasks);
      setShowUndoBar(false);
      setUndoSnapshot(null);
      setLastLLMAction(null);
    }
  };

  // Coach message generator - coaching (second person) vs reinforcing (first person)
  useEffect(() => {
    const currentWindow = getCurrentWindow(currentHour);
    const currentHabits = habits.filter(h => h.timeWindow === currentWindow && !h.completedToday);
    const completedCount = habits.filter(h => h.completedToday).length;
    const total = habits.length;

    let message = '';

    if (lastAction) {
      // Reinforcing mode - first person self-talk
      const messages = [
        `${lastAction.text} done. ${lastAction.streak + 1} days. I keep stacking.`,
        `${completedCount}/${total}. I carry the boats.`,
        `One more down. This is who I am.`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
    } else if (completedCount === total) {
      // All done - self-talk
      const messages = [
        `All ${total} crushed. I carry the boats.`,
        `Full sweep. This is who I am.`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
    } else if (currentHabits.length > 0) {
      // Coaching mode - second person
      const messages = [
        `${currentHabits[0].text} is up. You know what to do.`,
        `${TIME_WINDOWS[currentWindow].label} block. ${currentHabits[0].text} is waiting.`,
      ];
      message = messages[Math.floor(Math.random() * messages.length)];
    } else if (completedCount > 0) {
      message = `${completedCount} down, ${total - completedCount} to go. Keep moving.`;
    } else {
      message = `New day. ${total} opportunities to prove who you are.`;
    }

    setCoachMessage(message);
  }, [habits, currentHour, lastAction]);

  const completedHabitsToday = habits.filter(h => h.completedToday).length;
  const totalHabits = habits.length;

  const toggleHabit = (id) => {
    const habit = habits.find(h => h.id === id);
    const wasCompleted = habit.completedToday;
    
    setHabits(prev => prev.map(h => 
      h.id === id ? { ...h, completedToday: !h.completedToday, streak: !h.completedToday ? h.streak + 1 : Math.max(0, h.streak - 1) } : h
    ));

    // Trigger self-talk reinforcement when completing
    if (!wasCompleted) {
      setLastAction({ text: habit.text, streak: habit.streak });
      setTimeout(() => setLastAction(null), 4000);
    }
  };

  const deleteHabit = (id) => setHabits(prev => prev.filter(h => h.id !== id));
  const changeHabitWindow = (id, windowKey) => setHabits(prev => prev.map(h => h.id === id ? { ...h, timeWindow: windowKey } : h));
  const updateHabitText = (id, text) => setHabits(prev => prev.map(h => h.id === id ? { ...h, text } : h));
  const addHabitReflection = (id, reflection) => setHabits(prev => prev.map(h => 
    h.id === id ? { ...h, reflections: [...(h.reflections || []), reflection] } : h
  ));
  const addHabit = (text, timeWindow) => {
    if (text.trim()) {
      setHabits(prev => [...prev, { id: generateId(), text: text.trim(), streak: 0, completedToday: false, timeWindow, reflections: [] }]);
    }
  };

  const findAndUpdate = (tasks, id, updater) => tasks.map(task => task.id === id ? updater(task) : { ...task, children: findAndUpdate(task.children || [], id, updater) });
  const toggleTask = (id) => setTasks(prev => findAndUpdate(prev, id, t => ({ 
    ...t, 
    completed: !t.completed,
    completedAt: !t.completed ? new Date().toISOString().split('T')[0] : null
  })));
  const addReflection = (id, reflection) => setTasks(prev => findAndUpdate(prev, id, t => ({ ...t, reflection })));
  const addTask = (text) => {
    if (text.trim()) {
      setTasks(prev => [...prev, { id: generateId(), text: text.trim(), completed: false, completedAt: null, reflection: null, children: [] }]);
    }
  };
  const addSubtask = (parentId, text) => {
    setTasks(prev => findAndUpdate(prev, parentId, t => ({
      ...t,
      children: [...(t.children || []), { id: generateId(), text, completed: false, completedAt: null, reflection: null, children: [] }]
    })));
  };

  const handleAction = (action) => {
    // Create undo point before LLM-initiated changes
    createUndoPoint(`LLM action: ${action.type}`);
    setLastLLMAction(action.type);

    if (action.type === 'complete_task') {
      const findTaskId = (tasks, text) => {
        for (const task of tasks) {
          if (task.text === text) return task.id;
          if (task.children) {
            const found = findTaskId(task.children, text);
            if (found) return found;
          }
        }
        return null;
      };
      const taskId = findTaskId(tasks, action.taskText);
      if (taskId) toggleTask(taskId);
    } else if (action.type === 'add_task') {
      setTasks(prev => [...prev, { id: generateId(), text: action.text, completed: false, completedAt: null, reflection: null, children: [] }]);
    } else if (action.type === 'add_subtask') {
      const findAndAddChild = (tasks, parentText, newChild) => {
        return tasks.map(task => {
          if (task.text === parentText) {
            return { ...task, children: [...(task.children || []), newChild] };
          }
          return { ...task, children: findAndAddChild(task.children || [], parentText, newChild) };
        });
      };
      setTasks(prev => findAndAddChild(prev, action.parentText, { id: generateId(), text: action.text, completed: false, completedAt: null, reflection: null, children: [] }));
    } else if (action.type === 'filter_tasks') {
      handleFilterSearch(action.query);
    } else if (action.type === 'restructure_tasks') {
      // For major restructuring operations
      if (action.newTasks) {
        setTasks(action.newTasks);
      }
    }
  };

  const handleFilterSearch = async (query) => {
    if (!query.trim()) {
      setTaskFilter(null);
      setFilterQuery('');
      return;
    }
    
    setIsFiltering(true);
    const result = await interpretTaskFilter(query, tasks);
    setTaskFilter(result);
    setFilterQuery(query);
    setIsFiltering(false);
  };

  const clearFilter = () => {
    setTaskFilter(null);
    setFilterQuery('');
  };

  const windowOrder = Object.keys(TIME_WINDOWS);
  const sortedHabits = [...habits].sort((a, b) => windowOrder.indexOf(a.timeWindow) - windowOrder.indexOf(b.timeWindow));

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-orange-50/20">
      <div className={`transition-all duration-300 ${chatOpen ? 'mr-0 sm:mr-96' : ''}`}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          
          {/* Header */}
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-stone-800">Today</h1>
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={currentHour} 
                onChange={(e) => setCurrentHour(Number(e.target.value))} 
                className="text-xs bg-stone-100 border-0 rounded-lg px-2 py-1.5 text-stone-500 focus:outline-none"
              >
                {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
              <button
                onClick={() => setChatOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm rounded-lg hover:from-amber-600 hover:to-orange-600 transition-colors shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Plan
              </button>
            </div>
          </div>

          {/* Coach Message */}
          <p className="text-stone-600 text-sm mb-6 px-1">{coachMessage}</p>

          {/* Habits */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden mb-6">
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <span className="font-medium text-stone-800 text-sm">Habits</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-semibold text-emerald-600">{completedHabitsToday}</span>
                <span className="text-stone-300">/</span>
                <span className="text-stone-400 text-sm">{totalHabits}</span>
              </div>
            </div>
            <div className="px-5 divide-y divide-stone-50">
              {sortedHabits.map(habit => (
                <HabitItem 
                  key={habit.id} 
                  habit={habit} 
                  currentHour={currentHour} 
                  onToggle={toggleHabit}
                  onDelete={deleteHabit}
                  onChangeWindow={changeHabitWindow}
                  onUpdateText={updateHabitText}
                  onAddReflection={addHabitReflection}
                />
              ))}
            </div>
            <AddHabitRow onAdd={addHabit} />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-stone-200" />
            <span className="text-xs text-stone-400 uppercase tracking-wider">Tasks</span>
            <div className="flex-1 h-px bg-stone-200" />
          </div>

          {/* Tasks */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 overflow-hidden">
            <div className="px-5 py-3 border-b border-stone-100">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <span className="font-medium text-stone-800 text-sm">Tasks</span>
                </div>
              </div>
              
              {/* Search bar */}
              <div className="relative">
                <input
                  type="text"
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFilterSearch(filterQuery); if (e.key === 'Escape') clearFilter(); }}
                  placeholder='Search... (e.g. "done this week", "hiring", "all")'
                  className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-transparent"
                />
                <svg className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {(taskFilter || filterQuery) && (
                  <button 
                    onClick={clearFilter}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Filter status */}
              {taskFilter && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-stone-500">{taskFilter.description} ({taskFilter.count})</span>
                  <button onClick={clearFilter} className="text-xs text-rose-500 hover:text-rose-600">Clear</button>
                </div>
              )}
              {!taskFilter && !filterQuery && (
                <p className="mt-2 text-xs text-stone-400">Showing open tasks</p>
              )}
            </div>
            
            <div className="px-5 py-2">
              {isFiltering ? (
                <div className="py-8 text-center">
                  <div className="w-5 h-5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-stone-400">Searching...</p>
                </div>
              ) : taskFilter ? (
                // Filtered view
                taskFilter.groupedTasks ? (
                  // Grouped/hierarchical view
                  taskFilter.groupedTasks.length > 0 ? (
                    taskFilter.groupedTasks.map(task => (
                      <TaskItem key={task.id} task={task} depth={0} onToggle={toggleTask} onAddReflection={addReflection} onAddSubtask={addSubtask} showCompleted={true} />
                    ))
                  ) : (
                    <div className="py-8 text-center text-stone-400 text-sm">No tasks match your search</div>
                  )
                ) : (
                  // Flat list view
                  taskFilter.tasks.length > 0 ? (
                    taskFilter.tasks.map(task => (
                      <div key={task.id} className={`py-2 ${task.completed ? 'opacity-60' : ''}`}>
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => toggleTask(task.id)}
                            className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0
                              ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300 hover:border-emerald-400'}`}
                          >
                            {task.completed && (
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1">
                            <span className={`text-sm text-stone-700 ${task.completed ? 'line-through text-stone-400' : ''}`}>{task.text}</span>
                            {task.parent && (
                              <p className="text-xs text-stone-400 mt-0.5">in {task.parent}</p>
                            )}
                            {task.completedAt && (
                              <p className="text-xs text-stone-400 mt-0.5">Completed {task.completedAt}</p>
                            )}
                            {task.reflection && (
                              <p className="text-xs text-amber-600 mt-1 flex items-start gap-1 bg-amber-50 px-2 py-1 rounded">
                                <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                {task.reflection}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-stone-400 text-sm">No tasks match your search</div>
                  )
                )
              ) : (
                // Default view - hierarchical, incomplete only
                tasks.filter(t => !t.completed || (t.children && t.children.some(c => !c.completed))).length > 0 ? (
                  tasks.filter(t => !t.completed || (t.children && t.children.some(c => !c.completed))).map(task => (
                    <TaskItem key={task.id} task={task} depth={0} onToggle={toggleTask} onAddReflection={addReflection} onAddSubtask={addSubtask} showCompleted={false} />
                  ))
                ) : (
                  <div className="py-8 text-center text-stone-400 text-sm">All tasks complete! 🎉</div>
                )
              )}
            </div>
            
            {/* Add task UI */}
            <AddTaskRow onAdd={addTask} />
            
            {!taskFilter && (
              <div className="px-5 py-2 border-t border-stone-100">
                <button 
                  onClick={() => handleFilterSearch('all completed')}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  View completed tasks →
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-stone-400 text-xs mt-6">
            Click "Plan" to break down tasks and prioritize
          </p>
          
          {/* Export/Debug link */}
          <div className="text-center mt-4">
            <button
              onClick={() => {
                const md = serializeToMarkdown(habits, tasks);
                console.log('=== CURRENT STATE (Markdown) ===\n' + md);
                alert('Markdown exported to console. Check developer tools.');
              }}
              className="text-xs text-stone-300 hover:text-stone-500"
            >
              Export as Markdown
            </button>
          </div>
        </div>
      </div>

      {/* Undo Bar */}
      {showUndoBar && undoSnapshot && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-stone-800 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-4">
          <span className="text-sm">Changes applied by Plan</span>
          <button
            onClick={handleUndo}
            className="px-3 py-1 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 font-medium"
          >
            Undo
          </button>
          <button
            onClick={() => setShowUndoBar(false)}
            className="text-stone-400 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        habits={habits}
        tasks={tasks}
        currentHour={currentHour}
        onAction={handleAction}
      />

      {/* Overlay for mobile */}
      {chatOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 sm:hidden"
          onClick={() => setChatOpen(false)}
        />
      )}
    </div>
  );
}
