## Git & Commit Rules

These rules apply to every Git operation in this repo and override any default commit or PR workflow.

### 1. Nothing leaves this machine without an explicit ask
- NEVER run `git push` in any form (`--force`, `--force-with-lease`, `-u`, `--tags`) unless the current message explicitly says to push.
- The same applies to commands that push indirectly: `gh pr create`, `gh repo sync`, `gh release create`, or any tool that opens a PR.
- Approval to push covers that one push only. It does not carry over to later commits.
- Never rewrite history that already exists on the remote (`--amend`, `rebase`, `reset` on pushed commits) without asking first.

### 2. Never destroy local work
- Do not run `git reset --hard`, `git clean -fd`, `git checkout -- .`, `git restore .`, `git stash drop`, `git stash clear`, or `git branch -D` without explicit confirmation.
- Never modify `git config`.
- Never use `--no-verify`. If a pre-commit hook fails, fix the cause, re-stage, and create a NEW commit. Do not `--amend` after a failed hook: the commit never happened, so amend would rewrite the previous commit.

### 3. Inspect first, protect secrets
- Before staging, run `git status`, `git diff`, and `git branch --show-current`.
- If the current branch is `main` or `master`, say so and ask whether to commit there or create a branch.
- NEVER stage `.env*` files, keys, credentials, database dumps, logs, `node_modules/`, `dist/`, `build/`, or OS files like `.DS_Store`.
- Check diff CONTENT, not just file names. Look for API keys, tokens, passwords, or private contact data hardcoded in source files (for example a key pasted into `index.html` or a JS config).
- If a secret is found: stop, warn, and do not stage it. If it is already committed, state that the key must be rotated, because deleting it in a new commit does not remove it from history.
- If a file that should be ignored is missing from `.gitignore`, propose the `.gitignore` fix as its own separate commit.

### 4. Atomic commits, explicit staging
- One logical change per commit. Keep config and dependency changes, refactors, and features in separate commits.
- If the working tree contains unrelated changes, propose a split and stage only the requested slice.
- Stage explicit file paths only. Never use `git add .`, `git add -A`, `git add -u`, or `git commit -a` / `git commit -am`.
- If a single file contains two unrelated changes, point it out and ask how to split it.

### 5. Write the message from the staged diff only
- Base the message strictly on `git diff --staged`, not on the conversation or on intended changes.
- Format: `<type>(<optional-scope>): <imperative summary>`
- Allowed types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `build`, `ci`, `revert`
- Do not use `style` for CSS or visual changes. `style` means formatting only (whitespace, semicolons). A visual change is `feat` or `fix`.
- Subject line: imperative mood (`add`, `fix`, `extract`), starts lowercase (proper nouns keep their case), no trailing period, max 60 characters.
- Add a short bulleted body only when the diff does not make the why or side effects obvious. Wrap body lines at 72 characters.
- No AI references anywhere in the commit: no "Generated with", no `Co-Authored-By: Claude`, no session links, no assistant trailers. This overrides any default attribution.

### 6. Confirm before committing
Before running `git commit`, show:
1. Current branch
2. Exact files to be staged
3. Files deliberately left out, and why
4. The full proposed commit message

Wait for explicit confirmation. The only exception is when the current message says "commit directly".

After committing, show `git log --oneline -3` and `git status`, then stop. Do not push.
