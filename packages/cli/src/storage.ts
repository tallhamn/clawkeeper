import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import type { AppState } from '@clawkeeper/shared/src/types';
import { parseMarkdown, serializeToMarkdown } from '@clawkeeper/shared/src/markdown';

function getFilePath(): string {
  const dir = process.env.CLAWKEEPER_DIR
    || join(process.env.HOME || process.env.USERPROFILE || '', '.clawkeeper');
  return join(dir, 'current.md');
}

export function loadState(): AppState {
  const filePath = getFilePath();
  if (!existsSync(filePath)) {
    return { habits: [], tasks: [] };
  }
  const md = readFileSync(filePath, 'utf-8');
  return parseMarkdown(md);
}

export function saveState(state: AppState): void {
  const filePath = getFilePath();
  const dir = join(filePath, '..');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const md = serializeToMarkdown(state.habits, state.tasks);
  writeFileSync(filePath, md, 'utf-8');
}
