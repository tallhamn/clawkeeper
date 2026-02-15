import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Habit, Task } from './types';

// ── Shared mock functions ──
// These survive vi.resetModules() because they live in this file's scope,
// and vi.mock factories (hoisted) close over them.

const mockCreate = vi.fn();
const mockStream = vi.fn();
const mockIsOpenClawAvailable = vi.fn();
const mockGetOpenClawName = vi.fn();
const mockSendViaOpenClaw = vi.fn();
const mockStreamViaOpenClaw = vi.fn();
const mockResetOpenClawStatus = vi.fn();
const mockCheckOpenClawAvailable = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class Anthropic {
    messages = { create: mockCreate, stream: mockStream };
  },
}));

vi.mock('./storage', () => ({
  loadRecentArchives: vi.fn(),
}));

vi.mock('./search', () => ({
  performWebSearch: vi.fn(),
}));

vi.mock('./openclaw', () => ({
  checkOpenClawAvailable: (...args: unknown[]) => mockCheckOpenClawAvailable(...args),
  isOpenClawAvailable: (...args: unknown[]) => mockIsOpenClawAvailable(...args),
  getOpenClawName: (...args: unknown[]) => mockGetOpenClawName(...args),
  sendViaOpenClaw: (...args: unknown[]) => mockSendViaOpenClaw(...args),
  streamViaOpenClaw: (...args: unknown[]) => mockStreamViaOpenClaw(...args),
  resetOpenClawStatus: (...args: unknown[]) => mockResetOpenClawStatus(...args),
}));

// ── Helpers ──

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    text: 'Meditate',
    repeatIntervalHours: 24,
    lastCompleted: null,
    totalCompletions: 0,
    notes: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    text: 'Buy groceries',
    completed: false,
    completedAt: null,
    notes: [],
    children: [],
    ...overrides,
  };
}

// ── Tests ──

describe('claude', () => {
  let sendMessage: typeof import('./claude').sendMessage;
  let streamMessage: typeof import('./claude').streamMessage;
  let getActiveProvider: typeof import('./claude').getActiveProvider;
  let getProviderDisplayName: typeof import('./claude').getProviderDisplayName;
  let loadRecentArchives: ReturnType<typeof vi.fn>;
  let performWebSearch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the module registry so claude.ts re-evaluates its top-level
    // code (reading import.meta.env.VITE_ANTHROPIC_API_KEY, creating the
    // Anthropic client).  The vi.mock factories above are hoisted and
    // survive this reset.
    vi.resetModules();

    // Ensure the API key is set before the module is loaded
    vi.stubEnv('VITE_ANTHROPIC_API_KEY', 'test-api-key-123');

    // Default: OpenClaw is unavailable so existing tests hit Anthropic
    mockIsOpenClawAvailable.mockReturnValue(false);
    mockGetOpenClawName.mockReturnValue(null);
    mockCheckOpenClawAvailable.mockResolvedValue(false);

    // Re-import mocks fresh after resetModules
    const storage = await import('./storage');
    loadRecentArchives = storage.loadRecentArchives as ReturnType<typeof vi.fn>;
    loadRecentArchives.mockResolvedValue([]);

    const search = await import('./search');
    performWebSearch = search.performWebSearch as ReturnType<typeof vi.fn>;
    performWebSearch.mockResolvedValue('search results');

    // Import the module under test (fresh evaluation)
    const claude = await import('./claude');
    sendMessage = claude.sendMessage;
    streamMessage = claude.streamMessage;
    getActiveProvider = claude.getActiveProvider;
    getProviderDisplayName = claude.getProviderDisplayName;
  });

  // ─────────────────────────────────────────────
  // generateSystemPrompt (tested via sendMessage)
  // ─────────────────────────────────────────────

  describe('system prompt generation', () => {
    function captureSystemPrompt(): string {
      const call = mockCreate.mock.calls[0];
      return call[0].system as string;
    }

    it('should include the current hour', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      await sendMessage('hello', [], [], 14, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('14:00');
    });

    it('should show available habits with circle marker', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const habit = makeHabit({ text: 'Drink water', repeatIntervalHours: 4, lastCompleted: null });
      await sendMessage('hello', [habit], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('○ Drink water');
      expect(prompt).toContain('every 4h');
    });

    it('should show completed habits with check marker', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      // lastCompleted just now, interval 24h => still completed
      const habit = makeHabit({
        text: 'Exercise',
        repeatIntervalHours: 24,
        lastCompleted: new Date().toISOString(),
        totalCompletions: 5,
      });
      await sendMessage('hello', [habit], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('✓ Exercise');
      expect(prompt).toContain('every 1d');
      expect(prompt).toContain('5x');
    });

    it('should show habit interval in days when >= 24 hours', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const habit = makeHabit({ repeatIntervalHours: 72 }); // 3 days
      await sendMessage('hello', [habit], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('every 3d');
    });

    it('should show habit interval in hours when < 24 hours', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const habit = makeHabit({ repeatIntervalHours: 8 });
      await sendMessage('hello', [habit], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('every 8h');
    });

    it('should include habit notes', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const habit = makeHabit({
        notes: [{ text: 'Try morning sessions', createdAt: '2025-01-01T00:00:00Z' }],
      });
      await sendMessage('hello', [habit], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('📝 "Try morning sessions"');
    });

    it('should show completion count when totalCompletions > 0', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const habit = makeHabit({ totalCompletions: 12 });
      await sendMessage('hello', [habit], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('12x');
    });

    it('should not show completion count when totalCompletions is 0', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const habit = makeHabit({ totalCompletions: 0 });
      await sendMessage('hello', [habit], [], 10, []);

      const prompt = captureSystemPrompt();
      // The line for this habit should not contain "0x"
      expect(prompt).not.toContain('0x');
    });

    it('should show completed/total habits count', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const completed = makeHabit({
        id: 'h1',
        text: 'Done habit',
        lastCompleted: new Date().toISOString(),
        repeatIntervalHours: 24,
      });
      const available = makeHabit({ id: 'h2', text: 'Open habit', lastCompleted: null });
      await sendMessage('hello', [completed, available], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('Habits completed today: 1/2');
    });

    it('should render tasks with circle for incomplete and check for complete', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const tasks = [
        makeTask({ id: 't1', text: 'Open task', completed: false }),
        makeTask({ id: 't2', text: 'Done task', completed: true }),
      ];
      await sendMessage('hello', [], tasks, 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('○ Open task');
      expect(prompt).toContain('✓ Done task');
    });

    it('should render nested tasks with indentation', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const tasks = [
        makeTask({
          text: 'Parent task',
          children: [
            makeTask({ id: 'c1', text: 'Child task', children: [] }),
          ],
        }),
      ];
      await sendMessage('hello', [], tasks, 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('○ Parent task');
      expect(prompt).toContain('  ○ Child task');
    });

    it('should render deeply nested tasks with increasing indentation', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const tasks = [
        makeTask({
          text: 'Level 0',
          children: [
            makeTask({
              id: 'c1',
              text: 'Level 1',
              children: [
                makeTask({ id: 'c2', text: 'Level 2', children: [] }),
              ],
            }),
          ],
        }),
      ];
      await sendMessage('hello', [], tasks, 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('○ Level 0');
      expect(prompt).toContain('  ○ Level 1');
      expect(prompt).toContain('    ○ Level 2');
    });

    it('should render task notes with notepad emoji', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      const tasks = [
        makeTask({
          text: 'Research topic',
          notes: [{ text: 'Found a good article', createdAt: '2025-01-01T00:00:00Z' }],
        }),
      ];
      await sendMessage('hello', [], tasks, 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('📝 "Found a good article"');
    });

    it('should include archive context when archives are available', async () => {
      loadRecentArchives.mockResolvedValueOnce(['## January\n- Task A', '## February\n- Task B']);

      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      await sendMessage('hello', [], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).toContain('Recent Completed Tasks (Last 3 Months)');
      expect(prompt).toContain('## January');
      expect(prompt).toContain('## February');
    });

    it('should not include archive section when no archives exist', async () => {
      loadRecentArchives.mockResolvedValueOnce([]);

      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      await sendMessage('hello', [], [], 10, []);

      const prompt = captureSystemPrompt();
      expect(prompt).not.toContain('Recent Completed Tasks');
    });

    it('should request 3 months of archives', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'ok' }],
      });

      await sendMessage('hello', [], [], 10, []);

      expect(loadRecentArchives).toHaveBeenCalledWith(3);
    });
  });

  // ─────────────────────────────────────────────
  // sendMessage
  // ─────────────────────────────────────────────

  describe('sendMessage', () => {
    it('should call anthropic.messages.create with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hello!' }],
      });

      await sendMessage('hi there', [], [], 9, []);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const args = mockCreate.mock.calls[0][0];
      expect(args.model).toBe('claude-sonnet-4-20250514');
      expect(args.max_tokens).toBe(2048);
      expect(args.system).toContain('productivity assistant');
      expect(args.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'web_search' }),
        ])
      );
      // The last message should be the user message
      const lastMsg = args.messages[args.messages.length - 1];
      expect(lastMsg.role).toBe('user');
      expect(lastMsg.content).toBe('hi there');
    });

    it('should include conversation history in messages', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'sure' }],
      });

      const history = [
        { role: 'user' as const, content: 'first message' },
        { role: 'assistant' as const, content: 'first reply' },
      ];

      await sendMessage('second message', [], [], 10, history);

      const args = mockCreate.mock.calls[0][0];
      expect(args.messages).toHaveLength(3); // 2 history + 1 new
      expect(args.messages[0]).toEqual({ role: 'user', content: 'first message' });
      expect(args.messages[1]).toEqual({ role: 'assistant', content: 'first reply' });
      expect(args.messages[2]).toEqual({ role: 'user', content: 'second message' });
    });

    it('should extract text from the response', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Here is my advice.' }],
      });

      const result = await sendMessage('help me', [], [], 10, []);
      expect(result).toBe('Here is my advice.');
    });

    it('should return fallback message when no text block in response', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [], // no text blocks
      });

      const result = await sendMessage('hello', [], [], 10, []);
      expect(result).toBe('Sorry, I could not generate a response.');
    });

    it('should handle tool use loop for web_search', async () => {
      // First call returns tool_use
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_123',
            name: 'web_search',
            input: { query: 'best coffee shops' },
          },
        ],
      });

      // Second call returns final text
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Here are some coffee shops.' }],
      });

      performWebSearch.mockResolvedValueOnce('Result: Coffee Bean, Starbucks');

      const result = await sendMessage('find coffee shops', [], [], 10, []);

      // Should have called performWebSearch with the query
      expect(performWebSearch).toHaveBeenCalledWith('best coffee shops');

      // Should have called create twice (initial + after tool result)
      expect(mockCreate).toHaveBeenCalledTimes(2);

      // Second call should include the tool result
      const secondCallArgs = mockCreate.mock.calls[1][0];
      const messages = secondCallArgs.messages;
      // Messages should end with: ...assistant (tool_use), user (tool_result)
      const toolResultMsg = messages[messages.length - 1];
      expect(toolResultMsg.role).toBe('user');
      expect(toolResultMsg.content).toEqual([
        {
          type: 'tool_result',
          tool_use_id: 'tool_123',
          content: 'Result: Coffee Bean, Starbucks',
        },
      ]);

      expect(result).toBe('Here are some coffee shops.');
    });

    it('should include assistant tool_use content in messages after tool execution', async () => {
      const toolUseContent = [
        {
          type: 'tool_use',
          id: 'tool_abc',
          name: 'web_search',
          input: { query: 'test' },
        },
      ];

      mockCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: toolUseContent,
      });

      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'done' }],
      });

      performWebSearch.mockResolvedValueOnce('results');

      await sendMessage('search', [], [], 10, []);

      // The second call's messages should include the assistant message with the
      // original tool_use content
      const secondCallMessages = mockCreate.mock.calls[1][0].messages;
      const assistantMsg = secondCallMessages[secondCallMessages.length - 2];
      expect(assistantMsg.role).toBe('assistant');
      expect(assistantMsg.content).toEqual(toolUseContent);
    });

    it('should handle unknown tool gracefully in the tool loop', async () => {
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tool_456',
            name: 'unknown_tool',
            input: { foo: 'bar' },
          },
        ],
      });

      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Continued.' }],
      });

      const result = await sendMessage('do something', [], [], 10, []);

      // Should NOT call performWebSearch for an unknown tool
      expect(performWebSearch).not.toHaveBeenCalled();

      // The tool result should be 'Unknown tool'
      const secondCallMessages = mockCreate.mock.calls[1][0].messages;
      const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
      expect(toolResultMsg.content[0].content).toBe('Unknown tool');

      expect(result).toBe('Continued.');
    });

    it('should handle multiple rounds of tool use', async () => {
      // Round 1: tool use
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tool_1', name: 'web_search', input: { query: 'query 1' } },
        ],
      });

      // Round 2: another tool use
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          { type: 'tool_use', id: 'tool_2', name: 'web_search', input: { query: 'query 2' } },
        ],
      });

      // Round 3: final text
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Final answer after two searches.' }],
      });

      performWebSearch.mockResolvedValueOnce('result 1');
      performWebSearch.mockResolvedValueOnce('result 2');

      const result = await sendMessage('complex question', [], [], 10, []);

      expect(mockCreate).toHaveBeenCalledTimes(3);
      expect(performWebSearch).toHaveBeenCalledTimes(2);
      expect(performWebSearch).toHaveBeenNthCalledWith(1, 'query 1');
      expect(performWebSearch).toHaveBeenNthCalledWith(2, 'query 2');
      expect(result).toBe('Final answer after two searches.');
    });

    it('should break from tool loop when no tool_use block found despite stop_reason', async () => {
      // Edge case: stop_reason is tool_use but no tool_use block in content
      mockCreate.mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [{ type: 'text', text: 'No tool block here.' }],
      });

      const result = await sendMessage('edge case', [], [], 10, []);

      // Should only call create once (loop breaks)
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result).toBe('No tool block here.');
    });

    it('should wrap API errors with descriptive message', async () => {
      mockCreate.mockRejectedValueOnce(new Error('rate limit exceeded'));

      await expect(sendMessage('hello', [], [], 10, [])).rejects.toThrow(
        'Failed to get response from Claude: rate limit exceeded'
      );
    });

    it('should wrap non-Error API errors with generic message', async () => {
      mockCreate.mockRejectedValueOnce('some string error');

      await expect(sendMessage('hello', [], [], 10, [])).rejects.toThrow(
        'Failed to get response from Claude'
      );
    });
  });

  // ─────────────────────────────────────────────
  // sendMessage without API key
  // ─────────────────────────────────────────────

  describe('sendMessage without API key', () => {
    it('should throw when no API key is configured', async () => {
      // Reset and re-import with empty key
      vi.resetModules();
      vi.stubEnv('VITE_ANTHROPIC_API_KEY', '');

      const { sendMessage: sendNoKey } = await import('./claude');

      await expect(sendNoKey('hello', [], [], 10, [])).rejects.toThrow(
        'Claude API key not configured'
      );
    });
  });

  // ─────────────────────────────────────────────
  // streamMessage
  // ─────────────────────────────────────────────

  describe('streamMessage', () => {
    it('should throw when no API key is configured', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_ANTHROPIC_API_KEY', '');

      const { streamMessage: streamNoKey } = await import('./claude');

      const gen = streamNoKey('hello', [], [], 10, []);
      await expect(gen.next()).rejects.toThrow('Claude API key not configured');
    });

    it('should yield text deltas from the stream', async () => {
      const chunks = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
      ];

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      };

      const mockFinalMessage = vi.fn().mockResolvedValue({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Hello world' }],
      });

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIterator,
        [Symbol.asyncIterator]: mockAsyncIterator[Symbol.asyncIterator],
        finalMessage: mockFinalMessage,
      });

      const collected: string[] = [];
      for await (const chunk of streamMessage('hi', [], [], 10, [])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['Hello', ' world']);
    });

    it('should call messages.stream with correct parameters', async () => {
      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          // empty stream
        },
      };

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIterator,
        [Symbol.asyncIterator]: mockAsyncIterator[Symbol.asyncIterator],
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [],
        }),
      });

      const gen = streamMessage('test prompt', [], [], 15, []);
      // Exhaust the generator
      for await (const _ of gen) { /* drain */ }

      expect(mockStream).toHaveBeenCalledTimes(1);
      const args = mockStream.mock.calls[0][0];
      expect(args.model).toBe('claude-sonnet-4-20250514');
      expect(args.max_tokens).toBe(2048);
      expect(args.system).toContain('15:00');
      expect(args.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'web_search' }),
        ])
      );
    });

    it('should yield searching indicator when tool_use block starts', async () => {
      const chunks = [
        { type: 'content_block_start', content_block: { type: 'tool_use', id: 'tu1', name: 'web_search' } },
        { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"query":"test"}' } },
      ];

      // First stream: tool use
      const mockAsyncIter1 = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      };

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIter1,
        [Symbol.asyncIterator]: mockAsyncIter1[Symbol.asyncIterator],
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tu1', name: 'web_search', input: { query: 'test' } },
          ],
        }),
      });

      // Second stream: final text after tool result
      const textChunks = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Results found.' } },
      ];

      const mockAsyncIter2 = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of textChunks) {
            yield chunk;
          }
        },
      };

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIter2,
        [Symbol.asyncIterator]: mockAsyncIter2[Symbol.asyncIterator],
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Results found.' }],
        }),
      });

      performWebSearch.mockResolvedValueOnce('search data');

      const collected: string[] = [];
      for await (const chunk of streamMessage('search for test', [], [], 10, [])) {
        collected.push(chunk);
      }

      expect(collected).toContain('\n\n_Searching the web..._\n\n');
      expect(collected).toContain('Results found.');
      expect(performWebSearch).toHaveBeenCalledWith('test');
    });

    it('should handle unknown tool in streaming mode', async () => {
      const chunks = [
        { type: 'content_block_start', content_block: { type: 'tool_use', id: 'tu1', name: 'totally_unknown' } },
      ];

      const mockAsyncIter1 = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      };

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIter1,
        [Symbol.asyncIterator]: mockAsyncIter1[Symbol.asyncIterator],
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tu1', name: 'totally_unknown', input: {} },
          ],
        }),
      });

      // Second stream returns final text
      const mockAsyncIter2 = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Done.' } };
        },
      };

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIter2,
        [Symbol.asyncIterator]: mockAsyncIter2[Symbol.asyncIterator],
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Done.' }],
        }),
      });

      const collected: string[] = [];
      for await (const chunk of streamMessage('test', [], [], 10, [])) {
        collected.push(chunk);
      }

      // Should not have called performWebSearch for an unknown tool
      expect(performWebSearch).not.toHaveBeenCalled();
      // The second stream call should have the "Unknown tool" result
      const secondCallMessages = mockStream.mock.calls[1][0].messages;
      const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
      expect(toolResultMsg.content[0].content).toBe('Unknown tool');
      expect(collected).toContain('Done.');
    });

    it('should not yield input_json_delta chunks as text', async () => {
      const chunks = [
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"q":"x"}' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' there' } },
      ];

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) {
            yield chunk;
          }
        },
      };

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIterator,
        [Symbol.asyncIterator]: mockAsyncIterator[Symbol.asyncIterator],
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Hello there' }],
        }),
      });

      const collected: string[] = [];
      for await (const chunk of streamMessage('hi', [], [], 10, [])) {
        collected.push(chunk);
      }

      // Should only contain text deltas, not JSON input
      expect(collected).toEqual(['Hello', ' there']);
    });

    it('should wrap streaming errors with descriptive message', async () => {
      mockStream.mockRejectedValueOnce(new Error('network timeout'));

      const gen = streamMessage('hello', [], [], 10, []);
      await expect(gen.next()).rejects.toThrow(
        'Failed to get response from Claude: network timeout'
      );
    });

    it('should wrap non-Error streaming errors with generic message', async () => {
      mockStream.mockRejectedValueOnce(42);

      const gen = streamMessage('hello', [], [], 10, []);
      await expect(gen.next()).rejects.toThrow('Failed to get response from Claude');
    });
  });

  // ─────────────────────────────────────────────
  // OpenClaw routing
  // ─────────────────────────────────────────────

  describe('OpenClaw routing', () => {
    it('should return "anthropic" provider when OpenClaw is unavailable', () => {
      mockIsOpenClawAvailable.mockReturnValue(false);
      expect(getActiveProvider()).toBe('anthropic');
    });

    it('should return "openclaw" provider when OpenClaw is available', () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      expect(getActiveProvider()).toBe('openclaw');
    });

    it('should return display name from OpenClaw when available', () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      mockGetOpenClawName.mockReturnValue('Clawcus');
      expect(getProviderDisplayName()).toBe('Clawcus');
    });

    it('should return "OpenClaw" when name is not set', () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      mockGetOpenClawName.mockReturnValue(null);
      expect(getProviderDisplayName()).toBe('OpenClaw');
    });

    it('should return "Claude" when OpenClaw is unavailable', () => {
      mockIsOpenClawAvailable.mockReturnValue(false);
      expect(getProviderDisplayName()).toBe('Claude');
    });

    it('should route sendMessage through OpenClaw when available', async () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      mockSendViaOpenClaw.mockResolvedValueOnce('OpenClaw response');

      const result = await sendMessage('hello', [], [], 10, []);

      expect(result).toBe('OpenClaw response');
      expect(mockSendViaOpenClaw).toHaveBeenCalledTimes(1);
      // Should NOT have called Anthropic
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should pass system prompt and messages to sendViaOpenClaw', async () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      mockSendViaOpenClaw.mockResolvedValueOnce('ok');

      await sendMessage('test msg', [], [], 14, [
        { role: 'user', content: 'prev' },
        { role: 'assistant', content: 'prev reply' },
      ]);

      const [systemPrompt, messages] = mockSendViaOpenClaw.mock.calls[0];
      expect(systemPrompt).toContain('productivity assistant');
      expect(systemPrompt).toContain('14:00');
      expect(messages).toEqual([
        { role: 'user', content: 'prev' },
        { role: 'assistant', content: 'prev reply' },
        { role: 'user', content: 'test msg' },
      ]);
    });

    it('should fall back to Anthropic when sendViaOpenClaw fails', async () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      mockSendViaOpenClaw.mockRejectedValueOnce(new Error('connection refused'));

      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Anthropic fallback' }],
      });

      const result = await sendMessage('hello', [], [], 10, []);

      expect(result).toBe('Anthropic fallback');
      expect(mockResetOpenClawStatus).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should route streamMessage through OpenClaw when available', async () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      mockStreamViaOpenClaw.mockReturnValueOnce(
        (async function* () {
          yield 'chunk1';
          yield 'chunk2';
        })()
      );

      const collected: string[] = [];
      for await (const chunk of streamMessage('hello', [], [], 10, [])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['chunk1', 'chunk2']);
      expect(mockStreamViaOpenClaw).toHaveBeenCalledTimes(1);
      expect(mockStream).not.toHaveBeenCalled();
    });

    it('should fall back to Anthropic when streamViaOpenClaw fails', async () => {
      mockIsOpenClawAvailable.mockReturnValue(true);
      mockStreamViaOpenClaw.mockImplementationOnce(async function* () {
        throw new Error('stream broke');
      });

      const mockAsyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Anthropic stream' } };
        },
      };

      mockStream.mockResolvedValueOnce({
        ...mockAsyncIterator,
        [Symbol.asyncIterator]: mockAsyncIterator[Symbol.asyncIterator],
        finalMessage: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Anthropic stream' }],
        }),
      });

      const collected: string[] = [];
      for await (const chunk of streamMessage('hello', [], [], 10, [])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['Anthropic stream']);
      expect(mockResetOpenClawStatus).toHaveBeenCalled();
      expect(mockStream).toHaveBeenCalledTimes(1);
    });

    it('should not route through OpenClaw when unavailable', async () => {
      mockIsOpenClawAvailable.mockReturnValue(false);

      mockCreate.mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Direct Anthropic' }],
      });

      const result = await sendMessage('hello', [], [], 10, []);

      expect(result).toBe('Direct Anthropic');
      expect(mockSendViaOpenClaw).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
