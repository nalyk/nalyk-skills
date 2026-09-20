---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to integrate work
---

# Finishing a Development Branch

**Core principle:** Verify tests → Detect environment → Present options →
Execute choice → Clean up.

## Step 1: Verify Tests

Run the project's full test suite.

**If tests fail:** Report failures and stop. The menu comes after a green
suite.

**If tests pass:** Continue.

## Step 2: Detect Environment

Check for upstream remote, PR tooling, and merge strategy:

```bash
git remote -v
git log --oneline main..HEAD
```

## Step 3: Present Options

Based on environment, offer the applicable subset:

1. **Squash merge** — clean history, one commit on main
2. **Merge commit** — preserves branch history
3. **Rebase and merge** — linear history
4. **Create PR** — if remote detected and PR tooling available
5. **Leave branch** — human partner will handle integration

Present rulings and deferred minors alongside the options so the human
partner can decide whether to address them before merge.

## Step 4: Execute Choice

Execute the chosen strategy. Proctor's git gate ensures tests pass before
the merge commit is allowed.

## Step 5: Clean Up

Delete the feature branch if merged:
```bash
git branch -d <branch-name>
```

If the branch used a git worktree, remove it first:
```bash
git worktree remove <worktree-path>
git branch -d <branch-name>
```

Check for any orphaned worktrees:
```bash
git worktree list
git worktree prune
```
