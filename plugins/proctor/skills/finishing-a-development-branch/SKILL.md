---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to integrate work
---

# Finishing a Development Branch

## Overview

**Core principle:** Verify tests. Detect environment. Present options.
Execute choice. Clean up. In that order, no shortcuts.

A branch is not finished because you think it's done — it's finished
when fresh test evidence proves it's done, the environment is correctly
detected, and the human partner chooses the integration strategy.

**Hook enforcement:** Proctor's git gate blocks merge commits without
fresh passing test evidence. The gate runs at commit time — you cannot
bypass it by claiming tests passed earlier. During SDD, Proctor also
performs done-condition validation: this skill's prompt carries the
result — every task marked complete in the ledger, no fix round open,
test evidence fresh and passing — with every ruling of the run. While a
task is unmarked or a fix round is open, `git merge` is denied.

## When to Use

- Implementation is complete and all tests pass
- After SDD final review is done and residuals are adjudicated
- When your human partner asks to merge, integrate, or finish the branch
- After a plan's tasks are all complete and reviewed

## When NOT to Use

- Tests are failing or haven't been run — run them first
- SDD tasks remain incomplete — finish them first
- Open fix rounds exist — resolve or adjudicate them first
- You haven't run proctor:verification-before-completion

## Dynamic Branch Detection

**Never hardcode `main` or `master` in git commands.** Detect the
default branch dynamically:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
  | sed 's@^refs/remotes/origin/@@' || echo main)
```

Use `$DEFAULT_BRANCH` in all subsequent commands. Some repositories use
`master`, `develop`, `trunk`, or custom names. Hardcoding `main` breaks
silently — the diff shows nothing, the merge targets the wrong branch,
and the error surfaces far from its cause.

## Step 1: Verify Tests

Run the project's full test suite. Fresh run, not cached.

```bash
# Run whatever the project uses — examples:
npm test
pytest
cargo test
go test ./...
```

**If tests fail:** Report failures and stop. The menu comes after a
green suite. Do not proceed to Step 2.

**If tests pass:** Record the evidence (command, output summary, exit
code) and continue. Proctor's hooks validate this evidence at commit
time.

## Step 2: Detect Environment

Check the upstream remote, PR tooling, branch divergence, and default
branch:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
  | sed 's@^refs/remotes/origin/@@' || echo main)

git remote -v
git log --oneline "${DEFAULT_BRANCH}..HEAD"
git diff --stat "${DEFAULT_BRANCH}..HEAD"
```

Note:
- Whether an upstream remote exists
- How many commits diverge from the default branch
- Whether PR tooling (gh, hub) is available
- Whether the repository has branch protection rules

## Step 3: Present Options

Based on environment, offer the applicable subset. Not all options apply
to every repository.

### Merge Strategies

| Strategy | When to Use | Trade-off |
|----------|-------------|-----------|
| **Squash merge** | Clean history desired; many small/WIP commits on branch | Loses individual commit history; one commit on default branch |
| **Merge commit** | Branch history is meaningful; multiple reviewers contributed | Preserves full branch history; noisier log |
| **Rebase and merge** | Linear history desired; commits are already clean and atomic | Linear log; rewrites commit hashes; can conflict on long branches |
| **Create PR** | Remote detected and PR tooling available; team review required | Defers merge to review process; standard for shared repos |
| **Leave branch** | Human partner will handle integration manually | No action taken; branch stays as-is |

Present rulings and deferred minors alongside the options so the human
partner can decide whether to address them before merge.

**Recommendation heuristic:**
- If the repo has branch protection or CI requirements: recommend PR
- If commits are clean and few (1-3): recommend rebase
- If commits are many or WIP-style: recommend squash
- If branch history has review value: recommend merge commit
- When in doubt: recommend PR and let the team process decide

## Step 4: Execute Choice

Execute the chosen strategy using the dynamically detected default
branch:

```bash
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null \
  | sed 's@^refs/remotes/origin/@@' || echo main)

# Squash merge:
git checkout "$DEFAULT_BRANCH"
git merge --squash <branch-name>
git commit

# Merge commit:
git checkout "$DEFAULT_BRANCH"
git merge --no-ff <branch-name>

# Rebase and merge:
git rebase "$DEFAULT_BRANCH"
git checkout "$DEFAULT_BRANCH"
git merge --ff-only <branch-name>
```

Proctor's git gate validates test evidence at the commit/merge point.
If evidence is stale or missing, the gate blocks the operation.

**SDD done-condition validation:** During SDD, Proctor checks:
- All tasks in the ledger are marked complete
- No fix rounds are open (all resolved or adjudicated at cap)
- Test evidence is fresh (within the configured staleness window)
- All tests pass

The result is in this skill's prompt, naming each unmet condition. The
merge gate denies a merge while tasks or fix rounds are open, and the
test gate while evidence is stale or failing. Address the condition —
do not bypass the hook.

## Step 5: Clean Up

### If the branch used a git worktree

Remove the worktree first, then the branch:

```bash
git worktree remove <worktree-path>
git branch -d <branch-name>
```

### If the branch was a regular checkout

Delete the merged branch:

```bash
git branch -d <branch-name>
```

`-d` (lowercase) refuses to delete unmerged branches. Never use `-D`
unless the human partner explicitly requests it.

### Worktree hygiene

Check for orphaned worktrees and prune:

```bash
git worktree list
git worktree prune
```

### Remote branch cleanup

If the branch was pushed to remote and is now merged:

```bash
git push origin --delete <branch-name>
```

Only do this if the human partner confirms, or if the branch was created
by this session and no PR is open against it.

## Cross-Skill References

- **proctor:using-git-worktrees** — If the branch was created in a
  worktree, clean up the worktree before deleting the branch (Step 5).
  The worktree skill covers creation; this skill covers teardown.
- **proctor:verification-before-completion** — Run verification before
  entering this skill. The git gate enforces test evidence at commit
  time, but verification-before-completion governs the broader claim
  that work is complete.
- **proctor:subagent-driven-development** — SDD's Finish section
  directs you here. The SDD ledger's rulings and deferred minors should
  be presented to the human partner in Step 3.

## Red Flags — STOP

- Merging without fresh test evidence from this session
- Hardcoding `main` or `master` in git commands
- Using `git branch -D` (force delete) without human partner consent
- Skipping Step 3 (presenting options) and choosing a strategy yourself
- Merging during an open SDD fix round
- Claiming "tests passed earlier" as evidence

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Tests passed earlier" | Stale evidence. Run them now. The gate enforces this. |
| "It's obviously main" | Repositories use master, develop, trunk. Detect dynamically. |
| "Squash is always best" | Squash destroys branch history. Present options; let the human choose. |
| "I'll clean up worktrees later" | Orphaned worktrees accumulate. Clean up now. |
| "The fix round is basically done" | Open fix rounds block finishing. Resolve or adjudicate first. |
| "Just force-delete the branch" | `-D` skips the unmerged check. Use `-d` unless explicitly told otherwise. |
| "No need for a PR, it's a small change" | Branch protection rules exist for a reason. Check before deciding. |

## Checklist

1. Run full test suite — fresh, not cached
2. Confirm all tests pass (exit code 0, zero failures)
3. Detect default branch dynamically (`git symbolic-ref`)
4. Check for upstream remote and PR tooling
5. Review commit log against default branch (`git log "${DEFAULT_BRANCH}..HEAD"`)
6. If SDD: confirm all tasks complete, no open fix rounds, evidence fresh
7. Present merge strategy options with rulings and deferred minors
8. Wait for human partner's choice
9. Execute chosen strategy using dynamic branch name
10. Confirm git gate passes at commit/merge point
11. Clean up worktree if applicable (`git worktree remove`)
12. Delete merged branch with `-d` (not `-D`)
13. Prune orphaned worktrees (`git worktree prune`)
14. Clean up remote branch if applicable and confirmed
