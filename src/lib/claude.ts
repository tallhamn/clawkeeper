import Anthropic from '@anthropic-ai/sdk';
import type { Habit, Task } from './types';
import { loadRecentArchives } from './storage';
import { performWebSearch } from './search';

const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

if (!apiKey) {
  console.warn('VITE_ANTHROPIC_API_KEY not set. Claude API features will not work.');
}

const anthropic = apiKey ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) : null;

/**
 * Tool definitions for Claude
 */
const tools: Anthropic.Tool[] = [
  {
    name: 'web_search',
    description: 'Search the web for current information, local businesses, addresses, prices, or any real-time data. Use this when the user asks about things like "gas stations near me", "cheap places to...", specific addresses, current prices, or anything requiring up-to-date information from the internet.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query. Be specific and include location details if provided by the user.',
        },
      },
      required: ['query'],
    },
  },
];

/**
 * Generate system prompt with user's current context
 */
async function generateSystemPrompt(habits: Habit[], tasks: Task[], currentHour: number): Promise<string> {
  // Flatten tasks for context
  const flattenTasks = (tasks: Task[], depth = 0): string[] => {
    let result: string[] = [];
    for (const task of tasks) {
      const indent = '  '.repeat(depth);
      const status = task.completed ? '✓' : '○';
      result.push(`${indent}${status} ${task.text}`);
      if (task.reflections && task.reflections.length > 0) {
        const reflectionsText = task.reflections.slice(-2).map(r => `"${r}"`).join(', ');
        result.push(`${indent}  → Reflections: ${reflectionsText}`);
      }
      if (task.children && task.children.length > 0) {
        result = result.concat(flattenTasks(task.children, depth + 1));
      }
    }
    return result;
  };

  const habitsSummary = habits
    .map((h) => {
      const available = !h.lastCompleted ||
        (Date.now() - new Date(h.lastCompleted).getTime()) >= (h.repeatIntervalHours * 60 * 60 * 1000);
      const status = available ? '○' : '✓';
      const completions = h.totalCompletions > 0 ? `${h.totalCompletions}x` : '';
      const interval = h.repeatIntervalHours < 24 ? `${h.repeatIntervalHours}h` : `${Math.floor(h.repeatIntervalHours / 24)}d`;
      const reflections = h.reflections.length > 0 ? `\n    Reflections: ${h.reflections.slice(-2).map(r => `"${r}"`).join(', ')}` : '';
      return `  ${status} ${h.text} (every ${interval}) ${completions}${reflections}`;
    })
    .join('\n');

  const tasksSummary = flattenTasks(tasks).join('\n');

  const completedHabits = habits.filter((h) =>
    h.lastCompleted &&
    (Date.now() - new Date(h.lastCompleted).getTime()) < (h.repeatIntervalHours * 60 * 60 * 1000)
  ).length;
  const totalHabits = habits.length;

  // Load recent archives for coaching context
  const archives = await loadRecentArchives(3); // Last 3 months
  const archiveContext = archives.length > 0
    ? `\n\n**Recent Completed Tasks (Last 3 Months):**\n\n${archives.join('\n\n---\n\n')}`
    : '';

  return `You are a productivity assistant helping the user plan their day and break down tasks. The user follows a system-based approach (habits + tasks).

**Current Context:**
- Time: ${currentHour}:00 (current hour of the day)
- Habits completed today: ${completedHabits}/${totalHabits}

**User's Habits:**
${habitsSummary}

**User's Tasks:**
${tasksSummary}${archiveContext}

**Your Role:**
- Help break down complex tasks into concrete, actionable subtasks
- Suggest what to prioritize based on their current habits and tasks
- Be concise and actionable - suggest specific next steps
- Use a direct, motivational tone (not overly cheerful)
- When suggesting task breakdowns, provide 3-5 concrete subtasks
- **You have web search capability** - use it when users ask about real-time information, local businesses, addresses, prices, or current data

**Using Reflections:**
- Only reference reflections if they're directly relevant to the current request
- Use the user's exact words when quoting reflections
- Don't make up or infer reflections that aren't explicitly shown above
- If there are no relevant reflections, just focus on the task breakdown

**Making Changes:**
When the user asks you to make changes, propose them using JSON format in code blocks:

**Task Operations:**
\`\`\`json-action
{"type": "add_task", "text": "New task", "label": "Add 'New task'"}
\`\`\`

\`\`\`json-action
{"type": "delete_task", "taskText": "exact task name", "label": "Delete 'task name'"}
\`\`\`

\`\`\`json-action
{"type": "edit_task", "taskText": "old name", "newText": "new name", "label": "Rename task"}
\`\`\`

\`\`\`json-action
{"type": "add_subtask", "parentText": "parent", "text": "subtask", "label": "Add subtask"}
\`\`\`

**Habit Operations:**
\`\`\`json-action
{"type": "add_habit", "text": "Meditate", "repeatIntervalHours": 24, "label": "Add habit 'Meditate'"}
\`\`\`

\`\`\`json-action
{"type": "delete_habit", "habitText": "exact habit name", "label": "Delete 'habit name'"}
\`\`\`

\`\`\`json-action
{"type": "edit_habit", "habitText": "old name", "newText": "new name", "repeatIntervalHours": 24, "label": "Update habit"}
\`\`\`

The user will see approval buttons and can choose to apply your suggestions.

**Important:**
- ALWAYS use json-action blocks when proposing changes
- Don't say "I've deleted" or "I've added" - say "I can delete" or "I suggest adding"
- Keep responses brief (2-3 paragraphs max)
- Stay focused on the specific request - don't over-analyze or make assumptions`;
}

/**
 * Send a message to Claude and get a response
 */
export async function sendMessage(
  userMessage: string,
  habits: Habit[],
  tasks: Task[],
  currentHour: number,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!anthropic) {
    throw new Error('Claude API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.');
  }

  const systemPrompt = await generateSystemPrompt(habits, tasks, currentHour);

  try {
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    // Tool use loop
    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      tools: tools,
      messages: messages,
    });

    // Handle tool use
    while (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (!toolUseBlock) break;

      console.log('[Claude] Tool use:', toolUseBlock.name, toolUseBlock.input);

      // Execute the tool
      let toolResult: string;
      if (toolUseBlock.name === 'web_search') {
        const query = (toolUseBlock.input as { query: string }).query;
        toolResult = await performWebSearch(query);
      } else {
        toolResult = 'Unknown tool';
      }

      console.log('[Claude] Tool result:', toolResult);

      // Add assistant's response with tool use
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      // Add tool result
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: toolResult,
          },
        ],
      });

      // Continue conversation
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        tools: tools,
        messages: messages,
      });
    }

    // Extract final text response
    const textContent = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    if (textContent) {
      return textContent.text;
    }

    return 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('Claude API error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to get response from Claude: ${error.message}`);
    }
    throw new Error('Failed to get response from Claude');
  }
}

/**
 * Stream a message to Claude and get a streaming response
 */
export async function* streamMessage(
  userMessage: string,
  habits: Habit[],
  tasks: Task[],
  currentHour: number,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): AsyncGenerator<string, void, unknown> {
  if (!anthropic) {
    throw new Error('Claude API key not configured. Please add VITE_ANTHROPIC_API_KEY to your .env file.');
  }

  const systemPrompt = await generateSystemPrompt(habits, tasks, currentHour);

  try {
    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: userMessage,
      },
    ];

    let shouldContinue = true;
    let iterationCount = 0;

    while (shouldContinue) {
      iterationCount++;
      console.log('[Claude] Stream iteration:', iterationCount);
      shouldContinue = false;

      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        tools: tools,
        messages: messages,
      });


      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        } else if (chunk.type === 'content_block_start') {
          if (chunk.content_block.type === 'tool_use') {
            yield '\n\n_Searching the web..._\n\n';
          }
        } else if (chunk.type === 'content_block_delta' && chunk.delta.type === 'input_json_delta') {
          // Tool input is being streamed, we'll get the final version from the message
        }
      }

      const finalMessage = await stream.finalMessage();

      // Check if we need to handle tool use
      const toolBlock = finalMessage.content.find(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      if (toolBlock && finalMessage.stop_reason === 'tool_use') {
        console.log('[Claude] Tool use detected:', toolBlock.name, 'with input:', toolBlock.input);

        // Execute the tool
        let toolResult: string;
        if (toolBlock.name === 'web_search') {
          const query = (toolBlock.input as { query: string }).query;
          console.log('[Claude] Executing web search for query:', query);
          toolResult = await performWebSearch(query);
          console.log('[Claude] Search completed, result length:', toolResult.length, 'chars');
          console.log('[Claude] Search result preview:', toolResult.substring(0, 200));
        } else {
          toolResult = 'Unknown tool';
          console.log('[Claude] Unknown tool:', toolBlock.name);
        }

        // Add assistant's response with tool use
        messages.push({
          role: 'assistant',
          content: finalMessage.content,
        });
        console.log('[Claude] Added assistant message with tool use');

        // Add tool result
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: toolResult,
            },
          ],
        });
        console.log('[Claude] Added tool result, continuing conversation...');

        shouldContinue = true;
      }
    }
  } catch (error) {
    console.error('Claude API streaming error:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to get response from Claude: ${error.message}`);
    }
    throw new Error('Failed to get response from Claude');
  }
}
