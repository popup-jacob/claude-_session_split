#!/usr/bin/env node

/**
 * session-fork: Read session .jsonl and manage forked sessions.
 *
 * Usage:
 *   node fork.js read <session-id> <project-dir>
 *   node fork.js create <context-file> [-a | -c]
 *   node fork.js list <project-dir>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const command = process.argv[2];

if (command === 'read') readSession();
else if (command === 'create') createForkSession();
else if (command === 'list') listSessions();
else {
  console.error('Usage: node fork.js <read|create|list> [args...]');
  process.exit(1);
}

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
      if (entry.type === 'user' || entry.type === 'assistant') {
        const msg = extractMessage(entry);
        if (msg) messages.push(msg);
      }
    } catch (e) {}
  }

  console.log(JSON.stringify(messages, null, 2));
}

function extractMessage(entry) {
  const role = entry.message?.role || entry.type;
  const content = entry.message?.content;
  if (!content) return null;

  let text = '';
  if (typeof content === 'string') {
    text = content;
  } else if (Array.isArray(content)) {
    text = content.filter(c => c.type === 'text' && c.text).map(c => c.text).join('\n');
  }

  if (!text.trim()) return null;

  // Remove bkit Feature Usage report (noise)
  text = text.replace(/─{2,}[\s\S]*?📊 bkit Feature Usage[\s\S]*?─{2,}/g, '').trim();
  if (!text) return null;

  return { role, text, timestamp: entry.timestamp };
}

function createForkSession() {
  const args = process.argv.slice(3).filter(a => !a.startsWith('-'));
  const contextFile = args[0];
  const autoLaunch = process.argv.includes('-a');
  const copyContext = process.argv.includes('-c');

  if (!contextFile || !fs.existsSync(contextFile)) {
    console.error('Usage: node fork.js create <context-file> [-a | -c]');
    process.exit(1);
  }

  const filePath = path.resolve(contextFile).replace(/\\/g, '/');
  const launchCmd = `claude "Read ${filePath} and continue the conversation based on that context."`;

  if (autoLaunch) {
    try {
      execSync(`start bash -c '${launchCmd}'`, { stdio: 'ignore', shell: true });
      console.log('Forked session launched in new terminal.');
    } catch (e) {
      console.error('Auto-launch failed.');
      copyToClipboard(launchCmd);
    }
  } else if (copyContext) {
    const content = fs.readFileSync(filePath, 'utf8').trim();
    copyToClipboard(content);
  } else {
    copyToClipboard(launchCmd);
    console.log(`Context saved: ${filePath}`);
  }
}

function copyToClipboard(text) {
  try {
    if (process.platform === 'win32') {
      execSync('powershell -command "Set-Clipboard -Value $input"', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else if (process.platform === 'darwin') {
      execSync('pbcopy', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    } else {
      execSync('xclip -selection clipboard', { input: text, stdio: ['pipe', 'ignore', 'ignore'] });
    }
    console.log('Copied to clipboard.');
  } catch (e) {
    console.log('Could not copy to clipboard. Run manually:');
    console.log(text);
  }
}

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
    .slice(0, 10)
    .map(e => ({
      sessionId: e.sessionId,
      summary: e.summary || 'No summary',
      firstPrompt: (e.firstPrompt || '').substring(0, 80),
      messageCount: e.messageCount,
      created: e.created,
      modified: e.modified
    }));

  console.log(JSON.stringify(entries, null, 2));
}
