import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to reset modules between tests so cached state is fresh
let checkOpenClawAvailable: typeof import('./openclaw').checkOpenClawAvailable;
let isOpenClawAvailable: typeof import('./openclaw').isOpenClawAvailable;
let resetOpenClawStatus: typeof import('./openclaw').resetOpenClawStatus;
let sendViaOpenClaw: typeof import('./openclaw').sendViaOpenClaw;
let streamViaOpenClaw: typeof import('./openclaw').streamViaOpenClaw;

const mockFetch = vi.fn();

describe('openclaw', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();

    // Set token so checks don't short-circuit
    vi.stubEnv('VITE_OPENCLAW_TOKEN', 'test-token');
    vi.stubEnv('VITE_OPENCLAW_URL', '');

    const mod = await import('./openclaw');
    checkOpenClawAvailable = mod.checkOpenClawAvailable;
    isOpenClawAvailable = mod.isOpenClawAvailable;
    resetOpenClawStatus = mod.resetOpenClawStatus;
    sendViaOpenClaw = mod.sendViaOpenClaw;
    streamViaOpenClaw = mod.streamViaOpenClaw;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // ─────────────────────────────────────────────
  // Health check
  // ─────────────────────────────────────────────

  describe('checkOpenClawAvailable', () => {
    function gatewayHtml(name = 'Assistant') {
      return `<script>window.__OPENCLAW_ASSISTANT_NAME__="${name}";</script>`;
    }

    it('should return true when gateway responds OK', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => gatewayHtml() });

      const result = await checkOpenClawAvailable();
      expect(result).toBe(true);
      expect(isOpenClawAvailable()).toBe(true);
    });

    it('should parse assistant name from gateway HTML', async () => {
      vi.resetModules();
      vi.stubGlobal('fetch', mockFetch);
      vi.stubEnv('VITE_OPENCLAW_TOKEN', 'test-token');
      vi.stubEnv('VITE_OPENCLAW_URL', '');

      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => gatewayHtml('Clawcus') });

      const mod = await import('./openclaw');
      await mod.checkOpenClawAvailable();

      expect(mod.getOpenClawName()).toBe('Clawcus');
    });

    it('should not store default "Assistant" name', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => gatewayHtml('Assistant') });

      await checkOpenClawAvailable();

      const mod = await import('./openclaw');
      expect(mod.getOpenClawName()).toBeNull();
    });

    it('should return false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await checkOpenClawAvailable();
      expect(result).toBe(false);
      expect(isOpenClawAvailable()).toBe(false);
    });

    it('should return false when no token is set', async () => {
      vi.resetModules();
      vi.stubEnv('VITE_OPENCLAW_TOKEN', '');

      const mod = await import('./openclaw');
      const result = await mod.checkOpenClawAvailable();
      expect(result).toBe(false);
      expect(mod.isOpenClawAvailable()).toBe(false);
      // Should not even call fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return false on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await checkOpenClawAvailable();
      expect(result).toBe(false);
    });

    it('should cache the result and not re-fetch', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => gatewayHtml() });

      await checkOpenClawAvailable();
      await checkOpenClawAvailable();
      await checkOpenClawAvailable();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent calls', async () => {
      mockFetch.mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, text: async () => gatewayHtml() }), 50))
      );

      const [r1, r2, r3] = await Promise.all([
        checkOpenClawAvailable(),
        checkOpenClawAvailable(),
        checkOpenClawAvailable(),
      ]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(r3).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should re-probe after resetOpenClawStatus', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => gatewayHtml() });
      await checkOpenClawAvailable();
      expect(isOpenClawAvailable()).toBe(true);

      resetOpenClawStatus();
      expect(isOpenClawAvailable()).toBe(false); // cache cleared

      mockFetch.mockResolvedValueOnce({ ok: false });
      await checkOpenClawAvailable();
      expect(isOpenClawAvailable()).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should fetch the gateway root URL', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: async () => gatewayHtml() });

      await checkOpenClawAvailable();

      // In test/dev mode, uses the /openclaw proxy path
      expect(mockFetch).toHaveBeenCalledWith(
        '/openclaw',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });
  });

  // ─────────────────────────────────────────────
  // sendViaOpenClaw
  // ─────────────────────────────────────────────

  describe('sendViaOpenClaw', () => {
    it('should send correct headers and body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello back' } }],
        }),
      });

      await sendViaOpenClaw('You are helpful.', [
        { role: 'user', content: 'Hi' },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token',
            'x-openclaw-agent-id': 'main',
            'x-openclaw-session-key': 'clawkeeper-planning',
          }),
        })
      );

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.stream).toBe(false);
      expect(body.messages[0]).toEqual({
        role: 'system',
        content: 'You are helpful.',
      });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
    });

    it('should return the response content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Here is my response.' } }],
        }),
      });

      const result = await sendViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ]);
      expect(result).toBe('Here is my response.');
    });

    it('should return empty string when response has no content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [] }),
      });

      const result = await sendViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ]);
      expect(result).toBe('');
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      });

      await expect(
        sendViaOpenClaw('system', [{ role: 'user', content: 'test' }])
      ).rejects.toThrow('OpenClaw API error: 502 Bad Gateway');
    });
  });

  // ─────────────────────────────────────────────
  // streamViaOpenClaw
  // ─────────────────────────────────────────────

  describe('streamViaOpenClaw', () => {
    function makeSSEStream(events: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      return new ReadableStream({
        start(controller) {
          for (const event of events) {
            controller.enqueue(encoder.encode(event + '\n'));
          }
          controller.close();
        },
      });
    }

    it('should yield content from SSE chunks', async () => {
      const stream = makeSSEStream([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
        'data: [DONE]',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const collected: string[] = [];
      for await (const chunk of streamViaOpenClaw('system', [
        { role: 'user', content: 'hi' },
      ])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['Hello', ' world']);
    });

    it('should stop on [DONE]', async () => {
      const stream = makeSSEStream([
        'data: {"choices":[{"delta":{"content":"Before"}}]}',
        'data: [DONE]',
        'data: {"choices":[{"delta":{"content":"After"}}]}',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const collected: string[] = [];
      for await (const chunk of streamViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['Before']);
    });

    it('should skip malformed JSON lines', async () => {
      const stream = makeSSEStream([
        'data: {"choices":[{"delta":{"content":"Good"}}]}',
        'data: {broken json',
        'data: {"choices":[{"delta":{"content":" data"}}]}',
        'data: [DONE]',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const collected: string[] = [];
      for await (const chunk of streamViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['Good', ' data']);
    });

    it('should skip lines without content in delta', async () => {
      const stream = makeSSEStream([
        'data: {"choices":[{"delta":{"content":"Yes"}}]}',
        'data: {"choices":[{"delta":{}}]}',
        'data: {"choices":[{"delta":{"content":" indeed"}}]}',
        'data: [DONE]',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const collected: string[] = [];
      for await (const chunk of streamViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['Yes', ' indeed']);
    });

    it('should skip empty and non-data lines', async () => {
      const stream = makeSSEStream([
        '',
        ': comment',
        'data: {"choices":[{"delta":{"content":"Only this"}}]}',
        'data: [DONE]',
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const collected: string[] = [];
      for await (const chunk of streamViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ])) {
        collected.push(chunk);
      }

      expect(collected).toEqual(['Only this']);
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const gen = streamViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ]);
      await expect(gen.next()).rejects.toThrow(
        'OpenClaw API error: 500 Internal Server Error'
      );
    });

    it('should send stream: true in the body', async () => {
      const stream = makeSSEStream(['data: [DONE]']);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: stream,
      });

      const gen = streamViaOpenClaw('system', [
        { role: 'user', content: 'test' },
      ]);
      for await (const _ of gen) { /* drain */ }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.stream).toBe(true);
    });
  });
});
