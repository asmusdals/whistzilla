# Git workflow

Use this routine for implementation sessions:

1. Start with `git status --short --branch`, inspect the current branch and
   remote, and review any staged or unstaged changes before editing. Preserve
   work already present in the tree.
2. Work on a short-lived `codex/<topic>` branch for changes that are not yet
   ready for production. `main` is the Netlify production branch. Keep each
   commit scoped to a working slice that can be reviewed on its own.
3. Run the relevant tests, type checks, lint, and formatting checks. Inspect
   `git diff --check` and the staged diff before committing. Stage only the
   intended files and use a descriptive commit message.
4. Push the branch after a completed slice and again before ending the session
   when new commits exist. Confirm the remote branch points at the new commit.
   If pushing fails, keep the local commit and report the exact blocker.
5. Include the branch name, latest commit, test results, and push status in
   the handoff. Merge to `main` only when the feature is complete and ready
   for a production deployment.

An existing large backlog may need one checkpoint commit before the small-slice
routine can start. Do not rewrite existing commits or force-push to create that
checkpoint.
