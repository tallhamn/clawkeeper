import { Command } from '@tauri-apps/plugin-shell';

interface SearchResult {
  title: string;
  url: string;
  content: string;
}

interface TavilyResponse {
  answer?: string;
  results?: SearchResult[];
}

/**
 * Perform a web search using Tavily Search API via curl
 * Uses shell command to bypass Tauri HTTP plugin issues
 */
export async function performWebSearch(query: string): Promise<string> {
  const apiKey = import.meta.env.VITE_TAVILY_API_KEY;

  if (!apiKey) {
    console.warn('VITE_TAVILY_API_KEY not set. Web search will not work.');
    return 'Web search is not configured. Please add VITE_TAVILY_API_KEY to your .env file. You can get a free API key at https://tavily.com';
  }

  try {
    console.log('[Search] Searching for:', query);
    console.log('[Search] API Key present:', !!apiKey);

    const requestBody = {
      api_key: apiKey,
      query: query,
      search_depth: 'basic',
      include_answer: true,
      include_images: false,
      max_results: 5,
    };

    const requestJson = JSON.stringify(requestBody);
    console.log('[Search] Using curl to make request');

    // Use curl via shell command to bypass Tauri HTTP plugin issues
    const output = await Command.create('curl', [
      '-X', 'POST',
      'https://api.tavily.com/search',
      '-H', 'Content-Type: application/json',
      '-d', requestJson,
      '--silent'
    ]).execute();

    console.log('[Search] Curl exit code:', output.code);

    if (output.code !== 0) {
      console.error('[Search] Curl error:', output.stderr);
      return `Search failed: ${output.stderr}`;
    }

    const data = JSON.parse(output.stdout) as TavilyResponse;
    console.log('[Search] Got results:', JSON.stringify(data).substring(0, 500));

    // Format the results
    let result = '';

    // Include the AI-generated answer if available
    if (data.answer) {
      result += `**Quick Answer:**\n${data.answer}\n\n`;
    }

    // Include search results
    if (data.results && data.results.length > 0) {
      result += `**Search Results:**\n\n`;
      data.results.forEach((item, index) => {
        result += `${index + 1}. **${item.title}**\n`;
        result += `   ${item.content}\n`;
        result += `   Source: ${item.url}\n\n`;
      });
    }

    return result || 'No results found.';
  } catch (error) {
    console.error('[Search] Error performing web search:', error);
    return `Search error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
