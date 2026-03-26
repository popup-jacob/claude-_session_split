---
name: split
description: Split a specific topic from the current session into a new Claude Code session with only the relevant context.
user_invocable: true
---

# /split — Session Topic Fork

Fork a specific topic from the current conversation into a new, clean Claude Code session.

## Usage

```
/split "topic"       — save context file + copy launch command to clipboard (Ctrl+V in terminal)
/split -a "topic"    — save context file + auto-launch in new terminal
/split -c "topic"    — save context file + copy context content to clipboard (Ctrl+V in focus input)
```

Example:
```
/split "세션 분기 기능 관련된거"
/split -a "authentication implementation"
/split -c "버그 수정 관련"
```

## How It Works

When the user invokes `/split "topic"`, follow these steps **exactly in order**:

### Step 1: Get Session Info

Read the session context injected by the SessionStart hook. You need:
- `currentSessionId` — the current session ID
- `projectDir` — the Claude projects directory path

If session context is not available, find it manually:
1. The current working directory tells you the project
2. Sessions are stored in `~/.claude/projects/<project-key>/`
3. The project key is the cwd with path separators replaced by `-`

### Step 2: Read Current Session Messages

Run the fork script to get conversation messages:

```bash
node session-fork/scripts/split.js read <session-id> <project-dir>
```

This returns a JSON array of `{role, text, timestamp}` objects.

### Step 3: Analyze and Extract Relevant Context

From the conversation messages, identify everything related to the user's topic:

1. **Direct mentions** — messages that explicitly discuss the topic
2. **Supporting context** — decisions, constraints, or background info that the topic depends on
3. **Exclude** — unrelated discussions, greetings, off-topic questions

Be generous with context inclusion — it's better to include slightly more than to miss critical context.

### Step 4: Generate Fork Context

Create a complete summary of everything related to the topic. Include all relevant context — background, decisions, technical details, conclusions, open questions — without omitting anything important. Format is free; organize it in whatever way best fits the topic. The goal is that a new session reading this context can continue the work without hallucinating or missing prior discussion.

### Step 5: Save and Execute

1. Write the generated context to `session-fork/scripts/_fork-context.txt`

2. Run fork.js create with the appropriate flag based on user's command:

```bash
# Default (/split "topic"): copy launch command to clipboard
node session-fork/scripts/split.js create session-fork/scripts/_fork-context.txt

# -a (/split -a "topic"): auto-launch new terminal
node session-fork/scripts/split.js create session-fork/scripts/_fork-context.txt -a

# -c (/split -c "topic"): copy context content to clipboard
node session-fork/scripts/split.js create session-fork/scripts/_fork-context.txt -c
```

## Important Rules

- **Do NOT include the entire conversation** — only what's relevant to the topic
- **Do NOT include system-reminder tags** — they're noise
- **Do NOT include tool call details** — summarize outcomes instead
- **DO preserve key decisions and their reasoning**
- **DO include file paths and code snippets that are relevant**
- **DO mention what's been tried and what worked/didn't work**

## Edge Cases

- If the topic is too vague, ask the user to be more specific
- If the topic covers most of the conversation, suggest using `--fork-session` instead (full copy is more appropriate)
- If there's very little content about the topic, tell the user and ask if they still want to fork
