import { useState, useEffect, useRef } from 'react';
import type { Habit, Task, LLMAction } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { streamMessage } from '@/lib/claude';

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
}

export function ChatPanel({ isOpen, onClose, habits, tasks, currentHour, onAction }: ChatPanelProps) {
  // Count total notes from habits and tasks
  const countNotes = () => {
    let count = 0;
    // Count habit notes
    habits.forEach((habit) => {
      count += habit.notes?.length || 0;
    });
    // Count task notes recursively
    const countTaskNotes = (task: Task): void => {
      count += task.notes?.length || 0;
      task.children?.forEach(countTaskNotes);
    };
    tasks.forEach(countTaskNotes);
    return count;
  };

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: `I can see your ${habits.length} habits and ${tasks.length} projects, and ${countNotes()} notes. How can I help?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update the initial message when habits or tasks change
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length > 0 && prev[0].id === '1') {
        // Update the first message with current counts
        return [
          {
            ...prev[0],
            text: `I can see your ${habits.length} habits and ${tasks.length} projects, and ${countNotes()} notes. How can I help?`,
          },
          ...prev.slice(1),
        ];
      }
      return prev;
    });
  }, [habits, tasks]);

  useEffect(() => {
    // scrollIntoView might not exist in test environment
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingText]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = { id: generateId(), role: 'user', text: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    const userInput = input.trim();
    setInput('');
    setIsTyping(true);
    setStreamingText('');

    try {
      // Get conversation history for context (filter out system messages)
      const conversationHistory = messages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.text,
        }));

      // Stream response from Claude
      let fullResponse = '';

      for await (const chunk of streamMessage(userInput, habits, tasks, currentHour, conversationHistory)) {
        fullResponse += chunk;
        setStreamingText(fullResponse);
      }

      // Parse actions from response
      const actions = parseActionsFromResponse(fullResponse, habits, tasks);

      // Add complete message
      setIsTyping(false);
      setStreamingText('');
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'assistant',
          text: fullResponse,
          actions,
        },
      ]);
    } catch (error) {
      setIsTyping(false);
      setStreamingText('');

      let errorMessage = 'Sorry, I encountered an error. ';
      if (error instanceof Error) {
        if (error.message.includes('API key not configured')) {
          errorMessage += 'Please set your VITE_ANTHROPIC_API_KEY in a .env file.';
        } else {
          errorMessage += error.message;
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: 'system',
          text: errorMessage,
        },
      ]);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay for mobile */}
      <div className="fixed inset-0 bg-black/20 z-40 sm:hidden" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-stone-200">
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between bg-white">
          <div>
            <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Planning</h3>
            <p className="text-xs text-stone-400 mt-0.5">Powered by Claude</p>
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
                <div className="text-xs text-rose-600 bg-rose-50 px-3 py-2 rounded-lg max-w-[85%]">{msg.text}</div>
              ) : (
                <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                  {/* Only show text bubble if there's text after stripping JSON */}
                  {stripJsonActionBlocks(msg.text) && (
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-stone-800 text-white rounded-br-md'
                          : 'bg-stone-100 text-stone-800 rounded-bl-md'
                      }`}
                    >
                      {stripJsonActionBlocks(msg.text)}
                    </div>
                  )}

                  {/* Action buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.actions.map((action, actionIndex) => (
                        <button
                          key={actionIndex}
                          onClick={() => {
                            onAction(action);
                            // Remove only this specific action button and add success message
                            setMessages((prev) => [
                              ...prev.map((m) =>
                                m.id === msg.id
                                  ? { ...m, actions: m.actions?.filter((_, idx) => idx !== actionIndex) }
                                  : m
                              ),
                              {
                                id: generateId(),
                                role: 'system',
                                text: `✓ ${action.label || 'Action completed'}`,
                              },
                            ]);
                          }}
                          className="px-3 py-1.5 text-xs bg-kyoto-light text-kyoto-red rounded-lg hover:bg-kyoto-medium transition-colors flex items-center gap-1"
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

          {/* Streaming message */}
          {isTyping && streamingText && stripJsonActionBlocks(streamingText) && (
            <div className="flex justify-start">
              <div className="max-w-[85%]">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-stone-100 text-stone-800 whitespace-pre-wrap">
                  {stripJsonActionBlocks(streamingText)}
                  <span className="inline-block w-1 h-4 bg-stone-800 ml-0.5 animate-pulse" />
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator (before streaming starts) */}
          {isTyping && !streamingText && (
            <div className="flex justify-start">
              <div className="bg-stone-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <div
                    className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div
                    className="w-2 h-2 bg-stone-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
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
              className="flex-1 px-4 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-kyoto-red"
              disabled={isTyping}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="px-4 py-2.5 bg-kyoto-red text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-stone-400 mt-2 text-center">
            Try: "What should I focus on?" or "Break down the hiring task"
          </p>
        </div>
      </div>
    </>
  );
}

/**
 * Strip json-action code blocks from text (so they're not visible to user)
 * Also handles incomplete blocks during streaming
 */
function stripJsonActionBlocks(text: string): string {
  // Remove complete json-action blocks
  let cleaned = text.replace(/```json-action\s*\n[\s\S]*?\n```/g, '');

  // During streaming, also remove incomplete blocks
  // Match ``` followed by optional whitespace/newlines and "json" or "json-action"
  // This catches: ``` or ```j or ```json or ```json-a or ```json-action followed by anything
  cleaned = cleaned.replace(/```\s*j?s?o?n?-?a?c?t?i?o?n?[\s\S]*$/g, '');

  // Collapse multiple consecutive newlines (more than 2) into just 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Parse suggested actions from Claude's response
 */
function parseActionsFromResponse(text: string, habits: Habit[], tasks: Task[]): LLMAction[] {
  const actions: LLMAction[] = [];

  // Look for json-action code blocks
  const jsonActionRegex = /```json-action\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = jsonActionRegex.exec(text)) !== null) {
    try {
      const actionData = JSON.parse(match[1].trim());

      // Task actions
      if (actionData.type === 'add_task' && actionData.text) {
        actions.push({
          type: 'add_task',
          text: actionData.text,
          label: actionData.label || `Add "${actionData.text}"`,
        });
      } else if (actionData.type === 'complete_task' && actionData.taskText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          actions.push({
            type: 'complete_task',
            taskId,
            taskText: actionData.taskText,
            label: actionData.label || `Check off "${actionData.taskText}"`,
          });
        }
      } else if (actionData.type === 'uncomplete_task' && actionData.taskText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          actions.push({
            type: 'uncomplete_task',
            taskId,
            taskText: actionData.taskText,
            label: actionData.label || `Uncheck "${actionData.taskText}"`,
          });
        }
      } else if (actionData.type === 'delete_task' && actionData.taskText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          actions.push({
            type: 'delete_task',
            taskId,
            taskText: actionData.taskText,
            label: actionData.label || `Delete "${actionData.taskText}"`,
          });
        }
      } else if (actionData.type === 'add_subtask' && actionData.parentText && actionData.text) {
        const parentId = findTaskIdByText(tasks, actionData.parentText);
        if (parentId) {
          actions.push({
            type: 'add_subtask',
            parentId,
            text: actionData.text,
            label: actionData.label || `Add "${actionData.text}"`,
          });
        }
      } else if (actionData.type === 'edit_task' && actionData.taskText && actionData.text) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          actions.push({
            type: 'edit_task',
            taskId,
            text: actionData.text,
            label: actionData.label || `Update task`,
          });
        }
      } else if (actionData.type === 'move_task' && actionData.taskText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          let newParentId: string | undefined = undefined;
          if (actionData.newParentText) {
            newParentId = findTaskIdByText(tasks, actionData.newParentText) || undefined;
          }
          actions.push({
            type: 'move_task',
            taskId,
            taskText: actionData.taskText,
            newParentId,
            newParentText: actionData.newParentText,
            label: actionData.label || `Move "${actionData.taskText}"`,
          });
        }
      } else if (actionData.type === 'add_note' && actionData.taskText && actionData.noteText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          actions.push({
            type: 'add_note',
            taskId,
            taskText: actionData.taskText,
            noteText: actionData.noteText,
            label: actionData.label || `Add note to "${actionData.taskText}"`,
          });
        }
      } else if (actionData.type === 'edit_note' && actionData.taskText && actionData.noteText && actionData.newNoteText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          actions.push({
            type: 'edit_note',
            taskId,
            taskText: actionData.taskText,
            noteText: actionData.noteText,
            newNoteText: actionData.newNoteText,
            label: actionData.label || `Edit note on "${actionData.taskText}"`,
          });
        }
      } else if (actionData.type === 'delete_note' && actionData.taskText && actionData.noteText) {
        const taskId = findTaskIdByText(tasks, actionData.taskText);
        if (taskId) {
          actions.push({
            type: 'delete_note',
            taskId,
            taskText: actionData.taskText,
            noteText: actionData.noteText,
            label: actionData.label || `Delete note from "${actionData.taskText}"`,
          });
        }
      }

      // Habit actions
      else if (actionData.type === 'add_habit' && actionData.text) {
        actions.push({
          type: 'add_habit',
          text: actionData.text,
          repeatIntervalHours: actionData.repeatIntervalHours || 24,
          label: actionData.label || `Add habit "${actionData.text}"`,
        });
      } else if (actionData.type === 'delete_habit' && actionData.habitText) {
        const habitId = findHabitIdByText(habits, actionData.habitText);
        if (habitId) {
          actions.push({
            type: 'delete_habit',
            habitId,
            habitText: actionData.habitText,
            label: actionData.label || `Delete "${actionData.habitText}"`,
          });
        }
      } else if (actionData.type === 'edit_habit' && actionData.habitText) {
        const habitId = findHabitIdByText(habits, actionData.habitText);
        if (habitId) {
          actions.push({
            type: 'edit_habit',
            habitId,
            text: actionData.newText,
            repeatIntervalHours: actionData.repeatIntervalHours,
            label: actionData.label || `Update habit`,
          });
        }
      }
    } catch (e) {
      console.warn('Failed to parse JSON action:', e);
    }
  }

  // Fallback: Look for subtask suggestions with bullet points (legacy behavior)
  if (actions.length === 0) {
    const lines = text.split('\n');
    const bulletPoints: string[] = [];
    let parentTaskName = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this mentions a specific task
      if (line.toLowerCase().includes('for') || line.toLowerCase().includes('task:')) {
        for (const task of tasks) {
          if (line.toLowerCase().includes(task.text.toLowerCase().slice(0, 15))) {
            parentTaskName = task.text;
            break;
          }
        }
      }

      // Collect bullet points (potential subtasks)
      if (line.match(/^[•\-\*]\s+/)) {
        const subtask = line.replace(/^[•\-\*]\s+/, '').trim();
        if (subtask.length > 5 && subtask.length < 100) {
          bulletPoints.push(subtask);
        }
      }
    }

    // If we found 2-5 bullet points and a parent task, suggest adding them
    if (bulletPoints.length >= 2 && bulletPoints.length <= 5 && parentTaskName) {
      const parentId = findTaskIdByText(tasks, parentTaskName);

      if (parentId) {
        for (const subtask of bulletPoints) {
          actions.push({
            type: 'add_subtask',
            parentId,
            text: subtask,
            label: `Add "${subtask.slice(0, 30)}${subtask.length > 30 ? '...' : ''}"`,
          });
        }
      }
    }
  }

  return actions;
}

/**
 * Helper function to find task ID by text
 * Only matches active (non-completed) tasks
 */
function findTaskIdByText(tasks: Task[], text: string): string | null {
  const searchText = text.toLowerCase();

  const search = (taskList: Task[]): string | null => {
    for (const task of taskList) {
      // Skip completed tasks - they're read-only for historical context
      if (task.completed) {
        continue;
      }

      // Try exact match first
      if (task.text.toLowerCase() === searchText) {
        return task.id;
      }

      // Try partial match (for "wine task" matching "Buy wine for dinner")
      if (task.text.toLowerCase().includes(searchText) || searchText.includes(task.text.toLowerCase())) {
        return task.id;
      }

      // Search children (only if parent is not completed)
      if (task.children && task.children.length > 0) {
        const found = search(task.children);
        if (found) return found;
      }
    }
    return null;
  };

  return search(tasks);
}

/**
 * Helper function to find habit ID by text
 */
function findHabitIdByText(habits: Habit[], text: string): string | null {
  const searchText = text.toLowerCase();

  for (const habit of habits) {
    // Try exact match first
    if (habit.text.toLowerCase() === searchText) {
      return habit.id;
    }

    // Try partial match
    if (habit.text.toLowerCase().includes(searchText) || searchText.includes(habit.text.toLowerCase())) {
      return habit.id;
    }
  }

  return null;
}

