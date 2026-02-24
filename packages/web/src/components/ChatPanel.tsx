import { useState, useEffect, useRef } from 'react';
import type { Habit, Task, LLMAction } from '@clawkeeper/shared/src/types';
import { streamChat } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  actions?: LLMAction[];
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  habits: Habit[];
  tasks: Task[];
  currentHour: number;
  onAction: (action: LLMAction) => void;
  agents: Array<{ id: string; name?: string }>;
}

let msgCounter = 0;
function nextId() { return `msg-${++msgCounter}`; }

function generateSystemPrompt(habits: Habit[], tasks: Task[], currentHour: number): string {
  const flattenTasks = (tasks: Task[], depth = 0): string[] => {
    let result: string[] = [];
    for (const task of tasks) {
      const indent = '  '.repeat(depth);
      const status = task.completed ? '\u2713' : '\u25CB';
      const duePart = task.dueDate ? ` [due: ${task.dueDate}]` : '';
      result.push(`${indent}${status} ${task.text}${duePart}`);
      if (task.notes && task.notes.length > 0) {
        task.notes.forEach(n => result.push(`${indent}  \uD83D\uDCDD "${n.text}"`));
      }
      if (task.children && task.children.length > 0) {
        result = result.concat(flattenTasks(task.children, depth + 1));
      }
    }
    return result;
  };

  const habitsSummary = habits.map(h => {
    const available = !h.lastCompleted || (Date.now() - new Date(h.lastCompleted).getTime()) >= (h.repeatIntervalHours * 60 * 60 * 1000);
    const status = available ? '\u25CB' : '\u2713';
    const completions = h.totalCompletions > 0 ? `${h.totalCompletions}x` : '';
    const interval = h.repeatIntervalHours < 24 ? `${h.repeatIntervalHours}h` : `${Math.floor(h.repeatIntervalHours / 24)}d`;
    const notes = h.notes && h.notes.length > 0 ? h.notes.map(n => `\n    \uD83D\uDCDD "${n.text}"`).join('') : '';
    return `  ${status} ${h.text} (every ${interval}) ${completions}${notes}`;
  }).join('\n');

  const completedHabits = habits.filter(h =>
    h.lastCompleted && (Date.now() - new Date(h.lastCompleted).getTime()) < (h.repeatIntervalHours * 60 * 60 * 1000)
  ).length;

  return `**Current Context:**
- Time: ${currentHour}:00
- Habits completed today: ${completedHabits}/${habits.length}

**User's Habits:**
${habitsSummary}

**User's Tasks:**
${flattenTasks(tasks).join('\n')}

**Making Changes:**
When the user asks you to make changes to habits or tasks, propose them using JSON format in code blocks:

\`\`\`json-action
{"type": "add_task", "text": "New task", "label": "Add 'New task'"}
\`\`\`

\`\`\`json-action
{"type": "add_subtask", "parentText": "parent", "text": "subtask", "label": "Add subtask"}
\`\`\`

\`\`\`json-action
{"type": "complete_task", "taskText": "exact task name", "label": "Check off task"}
\`\`\`

\`\`\`json-action
{"type": "delete_task", "taskText": "exact task name", "label": "Delete task"}
\`\`\`

\`\`\`json-action
{"type": "add_habit", "text": "Meditate", "repeatIntervalHours": 24, "label": "Add habit"}
\`\`\`

The user will see approval buttons. Keep responses brief (2-3 paragraphs max).`;
}

export function ChatPanel({ isOpen, onClose, habits, tasks, currentHour, onAction, agents }: ChatPanelProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => agents[0]?.id || 'main');
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [conversationsByAgent, setConversationsByAgent] = useState<Record<string, Message[]>>({});
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const agentPickerRef = useRef<HTMLDivElement>(null);

  // Ensure selectedAgentId stays valid
  useEffect(() => {
    if (agents.length > 0 && !agents.find(a => a.id === selectedAgentId)) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  // Get or create messages for current agent
  const getWelcomeMessage = (): Message => ({
    id: 'welcome',
    role: 'assistant',
    text: `I can see your ${habits.length} habits and ${tasks.filter(t => !t.completed).length} tasks. How can I help?`,
  });

  const messages = conversationsByAgent[selectedAgentId] || [getWelcomeMessage()];

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setConversationsByAgent(prev => {
      const current = prev[selectedAgentId] || [getWelcomeMessage()];
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...prev, [selectedAgentId]: next };
    });
  };

  // Update welcome message when habits/tasks change
  useEffect(() => {
    setConversationsByAgent(prev => {
      const updated = { ...prev };
      for (const agentId of Object.keys(updated)) {
        const msgs = updated[agentId];
        if (msgs.length > 0 && msgs[0].id === 'welcome') {
          updated[agentId] = [{
            ...msgs[0],
            text: `I can see your ${habits.length} habits and ${tasks.filter(t => !t.completed).length} tasks. How can I help?`,
          }, ...msgs.slice(1)];
        }
      }
      return updated;
    });
  }, [habits, tasks]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Close agent picker on outside click
  useEffect(() => {
    if (!showAgentPicker) return;
    const handler = (e: MouseEvent) => {
      if (agentPickerRef.current && !agentPickerRef.current.contains(e.target as Node)) {
        setShowAgentPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAgentPicker]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { id: nextId(), role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsTyping(true);
    setStreamingText('');

    try {
      const conversationHistory = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => ({ role: msg.role, content: msg.text }));

      const systemPrompt = generateSystemPrompt(habits, tasks, currentHour);
      let fullResponse = '';

      for await (const chunk of streamChat(systemPrompt, [
        ...conversationHistory,
        { role: 'user', content: userInput },
      ], selectedAgentId)) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }

      const actions = parseActionsFromResponse(fullResponse, habits, tasks);

      setIsTyping(false);
      setStreamingText('');
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', text: fullResponse, actions }]);
    } catch (error) {
      setIsTyping(false);
      setStreamingText('');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setMessages(prev => [...prev, { id: nextId(), role: 'system', text: `Sorry, I encountered an error. ${errorMessage}` }]);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-tokyo-bg shadow-2xl z-50 flex flex-col border-l border-tokyo-border">
        <div className="px-4 py-3 border-b border-tokyo-border flex items-center justify-between bg-tokyo-surface">
          <div className="relative" ref={agentPickerRef}>
            <button
              onClick={() => agents.length > 1 && setShowAgentPicker(!showAgentPicker)}
              className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                agents.length > 1 ? 'text-tokyo-text-muted active:text-tokyo-text' : 'text-tokyo-text-muted cursor-default'
              }`}
            >
              <span>{selectedAgent?.name || selectedAgentId}</span>
              {agents.length > 1 && (
                <svg className={`w-3 h-3 transition-transform ${showAgentPicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            {showAgentPicker && (
              <div className="absolute left-0 top-full mt-1 bg-tokyo-surface border border-tokyo-border rounded-lg shadow-lg z-20 py-1 min-w-[140px]">
                {agents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => { setSelectedAgentId(agent.id); setShowAgentPicker(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                      agent.id === selectedAgentId
                        ? 'text-tokyo-blue bg-tokyo-blue-bg'
                        : 'text-tokyo-text active:bg-tokyo-surface-alt'
                    }`}
                  >
                    {agent.name || agent.id}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-tokyo-text-muted active:text-tokyo-text rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'system' ? (
                <div className="text-xs text-tokyo-red bg-tokyo-red/10 px-3 py-2 rounded-lg max-w-[85%]">{msg.text}</div>
              ) : (
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                  {stripJsonActionBlocks(msg.text) && (
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user' ? 'bg-tokyo-blue text-white rounded-br-md' : 'bg-tokyo-surface text-tokyo-text rounded-bl-md'
                    }`}>
                      {stripJsonActionBlocks(msg.text)}
                    </div>
                  )}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={() => {
                            onAction(action);
                            setMessages(prev => [
                              ...prev.map(m => m.id === msg.id
                                ? { ...m, actions: m.actions?.filter((_, idx) => idx !== actionIndex) }
                                : m
                              ),
                              { id: nextId(), role: 'system' as const, text: `\u2713 ${action.label || 'Action completed'}` },
                            ]);
                          }}
                          className="px-3 py-1.5 text-xs bg-tokyo-blue-bg text-tokyo-blue rounded-lg active:text-tokyo-blue-hover transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          {action.label || 'Apply'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {isTyping && streamingText && stripJsonActionBlocks(streamingText) && (
            <div className="flex justify-start">
              <div className="max-w-[85%]">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-tokyo-surface text-tokyo-text whitespace-pre-wrap">
                  {stripJsonActionBlocks(streamingText)}
                  <span className="inline-block w-1 h-4 bg-tokyo-text ml-0.5 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {isTyping && !streamingText && (
            <div className="flex justify-start">
              <div className="bg-tokyo-surface px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-tokyo-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-tokyo-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-tokyo-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-tokyo-border bg-tokyo-surface-alt">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="What do you want to work on?"
              className="flex-1 px-4 py-2.5 bg-tokyo-surface-alt border border-tokyo-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-tokyo-blue"
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="px-4 py-2.5 bg-tokyo-blue text-white rounded-lg active:bg-tokyo-blue-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-tokyo-text-dim mt-2 text-center">
            Try: "What should I focus on?" or "Break down the hiring task"
          </p>
        </div>
      </div>
    </>
  );
}

function stripJsonActionBlocks(text: string): string {
  let cleaned = text.replace(/```json-action\s*\n[\s\S]*?\n```/g, '');
  cleaned = cleaned.replace(/```\s*j?s?o?n?-?a?c?t?i?o?n?[\s\S]*$/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

function parseActionsFromResponse(text: string, habits: Habit[], tasks: Task[]): LLMAction[] {
  const actions: LLMAction[] = [];
  const jsonActionRegex = /```json-action\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = jsonActionRegex.exec(text)) !== null) {
    try {
      const actionData = JSON.parse(match[1].trim());

      if (actionData.type === 'add_task' && actionData.text) {
        actions.push({ type: 'add_task', text: actionData.text, label: actionData.label || `Add "${actionData.text}"` });
      } else if (actionData.type === 'complete_task' && actionData.taskText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) actions.push({ type: 'complete_task', taskId, taskText: actionData.taskText, label: actionData.label || `Check off "${actionData.taskText}"` });
      } else if (actionData.type === 'delete_task' && actionData.taskText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) actions.push({ type: 'delete_task', taskId, taskText: actionData.taskText, label: actionData.label || `Delete "${actionData.taskText}"` });
      } else if (actionData.type === 'add_subtask' && actionData.parentText && actionData.text) {
        const parentId = findTaskIdByText(tasks, actionData.parentText);
        if (parentId) actions.push({ type: 'add_subtask', parentId, text: actionData.text, label: actionData.label || `Add "${actionData.text}"` });
      } else if (actionData.type === 'edit_task' && actionData.taskText && actionData.text) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) actions.push({ type: 'edit_task', taskId, text: actionData.text, label: actionData.label || `Update task` });
      } else if (actionData.type === 'move_task' && actionData.taskText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          const newParentId = actionData.newParentText ? findTaskIdByText(tasks, actionData.newParentText) || undefined : undefined;
          actions.push({ type: 'move_task', taskId, taskText: actionData.taskText, newParentId, newParentText: actionData.newParentText, label: actionData.label || `Move "${actionData.taskText}"` });
        }
      } else if (actionData.type === 'add_note' && actionData.taskText && actionData.noteText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) actions.push({ type: 'add_note', taskId, taskText: actionData.taskText, noteText: actionData.noteText, label: actionData.label || `Add note` });
      } else if (actionData.type === 'add_habit' && actionData.text) {
        actions.push({ type: 'add_habit', text: actionData.text, repeatIntervalHours: actionData.repeatIntervalHours || 24, label: actionData.label || `Add habit "${actionData.text}"` });
      } else if (actionData.type === 'delete_habit' && actionData.habitText) {
        const habitId = findHabitIdByText(habits, actionData.habitText);
        if (habitId) actions.push({ type: 'delete_habit', habitId, habitText: actionData.habitText, label: actionData.label || `Delete "${actionData.habitText}"` });
      } else if (actionData.type === 'edit_habit' && actionData.habitText) {
        const habitId = findHabitIdByText(habits, actionData.habitText);
        if (habitId) actions.push({ type: 'edit_habit', habitId, text: actionData.newText, repeatIntervalHours: actionData.repeatIntervalHours, label: actionData.label || `Update habit` });
      }
    } catch {
      // skip malformed
    }
  }

  return actions;
}

function findTaskIdByText(tasks: Task[], text: string): string | null {
  const searchText = text.toLowerCase();
  const search = (taskList: Task[]): string | null => {
    for (const task of taskList) {
      if (task.completed) continue;
      if (task.text.toLowerCase() === searchText) return task.id;
      if (task.text.toLowerCase().includes(searchText) || searchText.includes(task.text.toLowerCase())) return task.id;
      if (task.children?.length) { const found = search(task.children); if (found) return found; }
    }
    return null;
  };
  return search(tasks);
}

function findHabitIdByText(habits: Habit[], text: string): string | null {
  const searchText = text.toLowerCase();
  for (const habit of habits) {
    if (habit.text.toLowerCase() === searchText) return habit.id;
    if (habit.text.toLowerCase().includes(searchText) || searchText.includes(habit.text.toLowerCase())) return habit.id;
  }
  return null;
}
