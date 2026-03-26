#!/usr/bin/env node

/**
 * SessionStart hook: injects current session ID and project path into context.
 * Claude Code passes session info via stdin as JSON.
 */

const fs = require('fs');
const path = require('path');

async function main() {
  // Read stdin (Claude Code hook input)
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  let hookData = {};
  try {
    hookData = JSON.parse(input);
  } catch (e) {
    // No input or invalid JSON
  }

  const sessionId = hookData.sessionId || process.env.CLAUDE_SESSION_ID || 'unknown';
  const cwd = hookData.cwd || process.cwd();

  // Find the sessions directory for this project
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const claudeDir = path.join(homeDir, '.claude', 'projects');

  // Convert project path to Claude's directory naming convention
  const projectKey = cwd.replace(/[:\\\/]/g, '-').replace(/^-/, '');

  // Find matching project directory (case-insensitive on Windows)
  let projectDir = '';
  try {
    const dirs = fs.readdirSync(claudeDir);
    const match = dirs.find(d => d.toLowerCase() === projectKey.toLowerCase());
    if (match) {
      projectDir = path.join(claudeDir, match);
    }
  } catch (e) {
    // Directory not found
  }

  // Output context for Claude
  const context = {
    sessionFork: {
      currentSessionId: sessionId,
      projectDir: projectDir,
      cwd: cwd,
      hint: 'Use /fork "topic" to branch a topic into a new session'
    }
  };

  // Output as system message
  console.log(JSON.stringify(context));
}

main().catch(() => process.exit(0));
