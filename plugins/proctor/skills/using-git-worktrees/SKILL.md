---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing plans
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace before any implementation
begins.

**Core principle:** Never implement on a protected branch. Isolation is
a precondition, not a convenience.

**Hook enforcement:** Proctor's branch protection gate blocks destructive
git operations on protected branches (main, master, production, release).
If you are on a protected branch and try to commit, the hook will deny
the operation and tell you to create a feature branch. The gate detects
the default branch dynamically — it does not assume `main`.

## When to Use

- Before executing any implementation plan (SDD or inline)
- When starting feature work on a shared repo
- When you need to preserve the default branch state
- When proctor:subagent-driven-development or proctor:executing-plans
  says "use proctor:using-git-worktrees for isolation"

**Never start implementation on a protected branch without your human
partner's explicit consent.** The hooks enforce this mechanically.

## Process

### Step 0: Detect existing isolation

Before creating anything, check if you are already isolated:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

**Submodule guard:** `GIT_DIR != GIT_COMMON` is also true inside git
submodules. Verify you are not in a submodule:

```bash
git rev-parse --show-superproject-working-tree 2>/dev/null
```

If that returns a path, you are in a submodule, not a worktree.

Already in a worktree on a feature branch? You are done — skip to
Step 3 (verify).

### Step 1: Detect the default branch

Never hardcode `main` or `master`:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
  | sed 's@^refs/remotes/origin/@@' || echo main)
```

### Step 2: Create the worktree

If the platform provides EnterWorktree/ExitWorktree tools (check tool
availability), use them — they handle path management and cleanup
registration automatically. Otherwise, create manually:

```bash
git worktree add -b <branch-name> ../<branch-name> HEAD
cd ../<branch-name>
```

Name the branch after the feature: `feature/add-auth-endpoint`,
`fix/null-check-user-service`, `refactor/extract-validation`.

When creating from a specific base:

```bash
git worktree add -b <branch-name> ../<branch-name> "origin/$DEFAULT_BRANCH"
```

### Step 3: Verify isolation

```bash
git branch --show-current   # Should be your feature branch
git log --oneline -1         # Should be at expected base
pwd                          # Should be in the worktree directory
```

All three must confirm isolation before proceeding.

### Step 4: Proceed to implementation

Load the appropriate execution skill:
- proctor:subagent-driven-development for SDD
- proctor:executing-plans for inline execution
- Or begin the bounded implementation from proctor:brainstorming

## Cleanup

Cleanup is handled by proctor:finishing-a-development-branch after
implementation is complete:

```bash
git worktree remove <worktree-path>
git branch -d <branch-name>
git worktree prune
```

If EnterWorktree was used, call ExitWorktree — it handles removal and
prune in one step.

**Do not clean up mid-implementation.** The worktree persists until the
branch is merged or abandoned.

## Cross-Skill References

- **proctor:finishing-a-development-branch** — handles worktree cleanup
  after merge; its Step 5 covers `worktree remove`, branch deletion,
  and orphan pruning
- **proctor:subagent-driven-development** — starts with "use
  proctor:using-git-worktrees" in its Setup section
- **proctor:executing-plans** — same setup requirement
- **proctor:brainstorming** — bounded path may need isolation before
  implementation

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll just commit directly to main" | The branch protection gate blocks it. Create a feature branch. |
| "Worktrees are overkill for this change" | Isolation is a precondition. The cost is one command. |
| "I'll create the branch later" | Later means after you've already written code on a protected branch. Now. |
| "I'm already on a branch, skip the check" | Step 0 exists because assumptions about branch state are wrong often enough to matter. |
| "I'll clean up the worktree now, I'm done with this task" | Cleanup is finishing-a-development-branch's job, after merge. Not yours, not now. |
| "EnterWorktree isn't available, I'll skip isolation" | Manual worktree creation works everywhere git does. No tool required. |

## Checklist

1. Run Step 0 — detect existing isolation (worktree check + submodule
   guard)
2. If already isolated on a feature branch, skip to step 5
3. Detect default branch dynamically (never hardcode)
4. Create worktree — use EnterWorktree if available, manual otherwise
5. Verify isolation: branch name, log, working directory
6. Proceed to implementation skill
