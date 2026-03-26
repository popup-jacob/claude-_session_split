# /split — Topic-Based Session Splitting for Claude Code

Split a specific topic from a long conversation into a new Claude Code session with only the relevant context.

## Problem

With 1M context, Claude Code conversations get very long. Multiple topics get mixed together and it's hard to remember what was discussed where. `--fork-session` copies the entire conversation, but you often only need one specific topic.

## Solution

`/split` extracts only the relevant context for a specific topic and lets you start a new session with just that context.

## Install

```bash
git clone https://github.com/popup-jacob/claude-_session_split.git session-fork
mkdir -p .claude/skills/split
cp session-fork/skills/split/SKILL.md .claude/skills/split/SKILL.md
```

Restart Claude Code. `/split` is now available.

## Usage

```
/split "topic"       → save context file + copy launch command to clipboard
/split -a "topic"    → save context file + auto-launch in new terminal
/split -c "topic"    → save context file + copy context to clipboard
```

### Default (recommended)

```
/split "authentication 관련"
```

Copies a launch command to clipboard. Open a new terminal and Ctrl+V → Enter.

### Auto-launch

```
/split -a "버그 수정 관련"
```

Automatically opens a new terminal with the forked session.

### Context copy (for focus input)

```
/split -c "DB schema 관련"
```

Copies the context content itself to clipboard. Paste it in Claude Code's focus input after `/clear`, or in a new session.

## How It Works

1. Reads current session's `.jsonl` file
2. AI analyzes all messages and extracts only what's related to your topic
3. Saves the context to `~/.claude/projects/<project>/`
4. Copies launch command or context to clipboard

## Files

```
session-fork/
├── hooks.json              ← SessionStart hook config
├── scripts/
│   ├── fork.js             ← Core: read .jsonl, create session, clipboard
│   └── session-context.js  ← Session ID injection hook
└── skills/
    └── split/
        └── SKILL.md        ← /split command definition
```

## Requirements

- Claude Code v2.1+
- Node.js
