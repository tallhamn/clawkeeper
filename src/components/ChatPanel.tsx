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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      text: `I can see your ${habits.length} habits and ${tasks.length} projects. What would you like to work on?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      // Get conversation history for context
      const conversationHistory = messages.map((msg) => ({
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
      const actions = parseActionsFromResponse(fullResponse, tasks);

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
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-stone-800 text-white rounded-br-md'
                        : 'bg-stone-100 text-stone-800 rounded-bl-md'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Action buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            onAction(action);
                            setMessages((prev) => [
                              ...prev,
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
          {isTyping && streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%]">
                <div className="px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed bg-stone-100 text-stone-800 whitespace-pre-wrap">
                  {streamingText}
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
 * Parse suggested actions from Claude's response
 */
function parseActionsFromResponse(text: string, tasks: Task[]): LLMAction[] {
  const actions: LLMAction[] = [];

  // Look for subtask suggestions with bullet points
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
    // Find the parent task ID
    const findTaskId = (tasks: Task[], name: string): string | null => {
      for (const task of tasks) {
        if (task.text === name) return task.id;
        if (task.children) {
          const found = findTaskId(task.children, name);
          if (found) return found;
        }
      }
      return null;
    };

    const parentId = findTaskId(tasks, parentTaskName);

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

  return actions;
}

