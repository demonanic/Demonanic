# Demonanic Repository Instructions

## Mandatory collaboration workflow

Follow this workflow for every development task in this repository.

### A. Before working

- Read this `AGENTS.md` and `docs/CHATGPT_HANDOFF.md`.
- Run `git status --short --branch`, `git branch --show-current`, and inspect recent commits.
- Record pre-existing uncommitted changes so they are not mistaken for task changes. Preserve them.
- Identify the user's approved objective, constraints, and acceptance criteria before making changes.

### B. During work

- Stay on the current authorized branch. Never switch branches unless the user explicitly authorizes it.
- Preserve user changes and secrets. Do not expose secrets in logs, documentation, or reports.
- Make the smallest complete, testable change that satisfies the approved objective.
- Update `docs/CHATGPT_HANDOFF.md` after meaningful audits, implementation, debugging, architectural decisions, and test runs.
- Record important findings, decisions, files changed, exact test commands and results, failures, unresolved issues, and next steps.
- Label verified facts separately from hypotheses, recommendations, and proposals. Do not silently turn a proposal into an approved decision.
- Never claim tests, builds, device checks, or deployments succeeded unless actually verified.
- Ask for approval before major architectural changes, destructive migrations, merges, deployments, or other consequential actions outside the approved scope.

### C. Before reporting completion

- Run relevant focused tests and broader tests when practical and within the approved task scope. Report checks that were not run.
- Run `git diff --check`.
- Review `git diff` and `git status`; distinguish task changes from the recorded pre-existing changes.
- Update `docs/CHATGPT_HANDOFF.md` with the actual final outcome, including failures and unrun checks.
- Keep the handoff's current status, branch, latest relevant commit, and next step accurate. If publishing creates a new commit, update the handoff before that commit and report its resulting SHA afterward.
- Never include credentials, tokens, secrets, or private user data in the handoff.

### D. Publish the handoff so ChatGPT can read it

- The exact user phrase `work done` signals that ChatGPT should review the latest handoff.
- At completion, ChatGPT must be able to retrieve the updated handoff from GitHub when publication is authorized and safe.
- If authorized and the remote is safely synchronized, stage **only** `docs/CHATGPT_HANDOFF.md` for a separate handoff-only commit. Never include gameplay files or unrelated changes in that commit.
- Push only the authorized current working branch, after checking ahead/behind status and verifying exactly which commit(s) would be published.
- Do not force-push, merge, rebase, switch branches, deploy, or publish unrelated local commits without explicit permission.
- If safe publication is blocked, do not bypass safeguards. Report that the handoff remains local, explain why, and give the exact next action needed.
- After publishing, verify the remote branch and handoff commit are updated. Never claim ChatGPT can see local-only changes.

### E. Final Codex report

- Give a concise, self-contained report of the objective completed, files changed, and material decisions or findings.
- State exact tests/checks run and their results; identify failures and checks not run.
- Report the final branch, relevant commit SHA(s), publication status, and remaining pre-existing/uncommitted changes.
- State the next step and any required user approval. Do not imply a push, deployment, or other external action occurred unless verified.
