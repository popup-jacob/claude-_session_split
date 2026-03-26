#!/usr/bin/env node

/**
 * session-fork: Core script for reading session .jsonl and creating forked sessions.
 *
 * Usage:
 *   node fork.js read <session-id> <project-dir>   → Read and output conversation messages
 *   node fork.js create <context-file>              → Create new session with context
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const command = process.argv[2];

if (command === 'read') {
  readSession();
} else if (command === 'create') {
  createForkSession();
} else if (command === 'list') {
  listSessions();
} else {
  console.error('Usage: node fork.js <read|create|list> [args...]');
  process.exit(1);
}

/**
 * Read a session's .jsonl and extract user/assistant messages
 */
function readSession() {
  const sessionId = process.argv[3];
  const projectDir = process.argv[4];

  if (!sessionId || !projectDir) {
    console.error('Usage: node fork.js read <session-id> <project-dir>');
    process.exit(1);
  }

  const jsonlPath = path.join(projectDir, `${sessionId}.jsonl`);

  if (!fs.existsSync(jsonlPath)) {
    console.error(`Session file not found: ${jsonlPath}`);
    process.exit(1);
  }

  const lines = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n');
  const messages = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Only extract user and assistant messages
      if (entry.type === 'user' || entry.type === 'assistant') {
        const msg = extractMessage(entry);
        if (msg) {
          messages.push(msg);
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  console.log(JSON.stringify(messages, null, 2));
}

/**
 * Extract readable message content from a .jsonl entry
 */
function extractMessage(entry) {
  const role = entry.message?.role || entry.type;
  const content = entry.message?.content;

  if (!content) return null;

  let text = '';

  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    // Concatenate text blocks, skip tool_use/tool_result/thinking
    const textParts = content
      .filter(c => c.type === 'text' && c.text)
      .map(c => c.text);
    text = textParts.join('\n');
  }

  if (!text.trim()) return null;

  // Remove bkit Feature Usage report (noise)
  text = text.replace(/─{2,}[\s\S]*?📊 bkit Feature Usage[\s\S]*?─{2,}/g, '').trim();

  if (!text) return null;

  return {
    role: role,
    text: text,
    timestamp: entry.timestamp
  };
}

/**
 * Create a new Claude Code session with the given context.
 * Default: save file + copy launch command to clipboard
 * -a: save file + auto-launch in new terminal
 * -c: save file + copy context content to clipboard
 */
function createForkSession() {
  const args = process.argv.slice(3).filter(a => !a.startsWith('-'));
  const contextFile = args[0];
  const autoLaunch = process.argv.includes('-a');
  const copyContext = process.argv.includes('-c');

  if (!contextFile) {
    console.error('Usage: node fork.js create <context-file> [-a | -c]');
    process.exit(1);
  }

  if (!fs.existsSync(contextFile)) {
    console.error(`Context file not found: ${contextFile}`);
    process.exit(1);
  }

  const absContextFile = path.resolve(contextFile);
  const unixPath = absContextFile.replace(/\\/g, '/');
  const launchCmd = `claude --append-system-prompt "$(cat "${unixPath}")"`;

  if (autoLaunch) {
    // -a: auto-launch in new terminal
    try {
      if (process.platform === 'win32') {
        execSync(`start bash -c '${launchCmd}'`, { stdio: 'ignore', shell: true });
      } else if (process.platform === 'darwin') {
        execSync(`osascript -e 'tell application "Terminal" to do script "${launchCmd.replace(/"/g, '\\"')}"'`, { stdio: 'ignore' });
      } else {
        execSync(`gnome-terminal -- bash -c '${launchCmd}' 2>/dev/null || xterm -e bash -c '${launchCmd}'`, { stdio: 'ignore', shell: true });
      }
      console.log('Forked session launched in new terminal.');
    } catch (e) {
      console.error('Auto-launch failed.');
      copyToClipboard(launchCmd);
    }
  } else if (copyContext) {
    // -c: copy context content to clipboard (for focus input)
    const content = fs.readFileSync(absContextFile, 'utf8').trim();
    copyToClipboard(content);
    console.log('Context content copied to clipboard. Ctrl+V in focus input or new session.');
  } else {
    // Default: copy launch command to clipboard (for terminal)
    copyToClipboard(launchCmd);
    console.log(`Context saved: ${absContextFile}`);
  }
}

/**
 * Copy text to system clipboard (cross-platform)
 */
function copyToClipboard(text) {
  try {
    if (process.platform === 'win32') {
      execSync('clip', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (process.platform === 'darwin') {
      execSync('pbcopy', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else {
      execSync('xclip -selection clipboard', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    }
    console.log('Copied to clipboard.');
  } catch (e) {
    console.log('Could not copy to clipboard. Use the file directly:');
    console.log(text.substring(0, 200) + '...');
  }
}

/**
 * List recent sessions for this project
 */
function listSessions() {
  const projectDir = process.argv[3];

  if (!projectDir) {
    console.error('Usage: node fork.js list <project-dir>');
    process.exit(1);
  }

  const indexPath = path.join(projectDir, 'sessions-index.json');

  if (!fs.existsSync(indexPath)) {
    console.error('sessions-index.json not found');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const entries = data.entries
    .sort((a, b) => (b.modified || b.created || '').localeCompare(a.modified || a.created || ''))
    .slice(0, 10);

  const summary = entries.map(e => ({
    sessionId: e.sessionId,
    summary: e.summary || 'No summary',
    firstPrompt: (e.firstPrompt || '').substring(0, 80),
    messageCount: e.messageCount,
    created: e.created,
    modified: e.modified
  }));

  console.log(JSON.stringify(summary, null, 2));
}
