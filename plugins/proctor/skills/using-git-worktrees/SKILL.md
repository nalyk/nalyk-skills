---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing plans
---

# Using Git Worktrees

Ensure work happens in an isolated workspace.

**Hook enforcement:** Proctor's branch protection gate blocks destructive
git operations on protected branches (main, master, production, release).
If you are on a protected branch and try to commit, the hook will deny
the operation and tell you to create a feature branch.

## Step 0: Detect Existing Isolation

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

If that returns a path, you're in a submodule, not a worktree.

Already in a worktree on a feature branch? You're done.

## Step 1: Create Worktree

If your platform has native worktree tools, use them. Otherwise:

```bash
git worktree add -b <branch-name> ../<branch-name> HEAD
cd ../<branch-name>
```

Name the branch after the feature: `feature/add-auth-endpoint`.

## Step 2: Verify Isolation

```bash
git branch --show-current  # Should be your feature branch
git log --oneline -1        # Should be at HEAD
```

## When to Use

- Before executing any implementation plan (SDD or inline)
- When starting feature work on a shared repo
- When you need to preserve the main branch state

**Never start implementation on a main/master branch without your human
partner's explicit consent.** The hooks enforce this.
