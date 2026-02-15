// In dev mode, use the Vite proxy to avoid CORS. In production, hit the gateway directly.
const OPENCLAW_URL = import.meta.env.VITE_OPENCLAW_URL
  || (import.meta.env.DEV ? '/openclaw' : 'http://127.0.0.1:18789');
const OPENCLAW_TOKEN = import.meta.env.VITE_OPENCLAW_TOKEN || '';

let cachedAvailable: boolean | null = null;
let cachedName: string | null = null;
let pendingCheck: Promise<boolean> | null = null;

/**
 * Check if the OpenClaw gateway is reachable.
 * Also fetches the assistant name from the gateway.
 * Caches the result and deduplicates concurrent calls.
 */
export async function checkOpenClawAvailable(): Promise<boolean> {
  if (!OPENCLAW_TOKEN) {
    cachedAvailable = false;
    return false;
  }

  if (cachedAvailable !== null) return cachedAvailable;
  if (pendingCheck) return pendingCheck;

  pendingCheck = (async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      // Fetch the control UI page to get the assistant name, and verify reachability
      const res = await fetch(OPENCLAW_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        cachedAvailable = false;
        return false;
      }

      // Parse assistant name from the gateway's HTML
      const html = await res.text();
      const nameMatch = html.match(/__OPENCLAW_ASSISTANT_NAME__="([^"]*)"/);
      if (nameMatch && nameMatch[1] && nameMatch[1] !== 'Assistant') {
        cachedName = nameMatch[1];
      }

      cachedAvailable = true;
      return true;
    } catch {
      cachedAvailable = false;
      return false;
    } finally {
      pendingCheck = null;
    }
  })();

  return pendingCheck;
}

/** Returns the cached availability status (null before first check). */
export function isOpenClawAvailable(): boolean {
  return cachedAvailable === true;
}

/** Returns the assistant name from the gateway, or null if unknown. */
export function getOpenClawName(): string | null {
  return cachedName;
}

/** Clears cached status so the next call to checkOpenClawAvailable re-probes. */
export function resetOpenClawStatus(): void {
  cachedAvailable = null;
  cachedName = null;
  pendingCheck = null;
}

/**
 * Send a non-streaming chat completion via OpenClaw.
 */
export async function sendViaOpenClaw(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const res = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENCLAW_TOKEN}`,
      'x-openclaw-agent-id': 'main',
      'x-openclaw-session-key': 'clawkeeper-planning',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenClaw API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * Stream a chat completion via OpenClaw using SSE.
 */
export async function* streamViaOpenClaw(
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${OPENCLAW_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENCLAW_TOKEN}`,
      'x-openclaw-agent-id': 'main',
      'x-openclaw-session-key': 'clawkeeper-planning',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenClaw API error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;

        try {
          const parsed = JSON.parse(payload);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
