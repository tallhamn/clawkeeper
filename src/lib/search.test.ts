import { describe, it, expect, vi, beforeEach } from 'vitest';
import { performWebSearch } from './search';

// Mock the Tauri shell plugin
vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: {
    create: vi.fn(),
  },
}));

describe('Web Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error message when API key is not configured', async () => {
    // Save original env
    const originalEnv = import.meta.env.VITE_TAVILY_API_KEY;

    // Remove API key
    vi.stubEnv('VITE_TAVILY_API_KEY', '');

    const result = await performWebSearch('test query');

    expect(result).toContain('Web search is not configured');
    expect(result).toContain('VITE_TAVILY_API_KEY');

    // Restore env
    vi.stubEnv('VITE_TAVILY_API_KEY', originalEnv);
  });

  it('should format search results with answer and sources', async () => {
    const mockResponse = {
      answer: 'Test answer from Tavily',
      results: [
        {
          title: 'Test Result 1',
          url: 'https://example.com/1',
          content: 'Test content 1',
        },
        {
          title: 'Test Result 2',
          url: 'https://example.com/2',
          content: 'Test content 2',
        },
      ],
    };

    // Mock the Command.create().execute() chain
    const { Command } = await import('@tauri-apps/plugin-shell');
    const mockExecute = vi.fn().mockResolvedValue({
      code: 0,
      stdout: JSON.stringify(mockResponse),
      stderr: '',
    });

    (Command.create as any).mockReturnValue({
      execute: mockExecute,
    });

    // Set API key
    vi.stubEnv('VITE_TAVILY_API_KEY', 'tvly-test-key');

    const result = await performWebSearch('test query');

    // Check that result contains formatted data
    expect(result).toContain('Quick Answer');
    expect(result).toContain('Test answer from Tavily');
    expect(result).toContain('Search Results');
    expect(result).toContain('Test Result 1');
    expect(result).toContain('https://example.com/1');
    expect(result).toContain('Test content 1');
    expect(result).toContain('Test Result 2');

    // Check that curl was called with correct arguments
    expect(Command.create).toHaveBeenCalledWith('curl', expect.arrayContaining([
      '-X', 'POST',
      'https://api.tavily.com/search',
      '-H', 'Content-Type: application/json',
      '--silent',
    ]));
  });

  it('should handle curl errors gracefully', async () => {
    // Mock curl failure
    const { Command } = await import('@tauri-apps/plugin-shell');
    const mockExecute = vi.fn().mockResolvedValue({
      code: 1,
      stdout: '',
      stderr: 'curl: (6) Could not resolve host',
    });

    (Command.create as any).mockReturnValue({
      execute: mockExecute,
    });

    vi.stubEnv('VITE_TAVILY_API_KEY', 'tvly-test-key');

    const result = await performWebSearch('test query');

    expect(result).toContain('Search failed');
    expect(result).toContain('Could not resolve host');
  });

  it('should handle JSON parse errors', async () => {
    // Mock invalid JSON response
    const { Command } = await import('@tauri-apps/plugin-shell');
    const mockExecute = vi.fn().mockResolvedValue({
      code: 0,
      stdout: 'not valid json',
      stderr: '',
    });

    (Command.create as any).mockReturnValue({
      execute: mockExecute,
    });

    vi.stubEnv('VITE_TAVILY_API_KEY', 'tvly-test-key');

    const result = await performWebSearch('test query');

    expect(result).toContain('Search error');
  });

  it('should return "No results found" when results are empty', async () => {
    const mockResponse = {
      results: [],
    };

    const { Command } = await import('@tauri-apps/plugin-shell');
    const mockExecute = vi.fn().mockResolvedValue({
      code: 0,
      stdout: JSON.stringify(mockResponse),
      stderr: '',
    });

    (Command.create as any).mockReturnValue({
      execute: mockExecute,
    });

    vi.stubEnv('VITE_TAVILY_API_KEY', 'tvly-test-key');

    const result = await performWebSearch('test query');

    expect(result).toBe('No results found.');
  });
});
