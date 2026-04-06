# Repository Instructions

- Store all secrets in the repository root `.env`.
- Keep `.env` limited to secrets only. Do not put non-secret flags, test toggles, or other configuration in that file.
- Use multiple subagents in parallel when possible, especially for independent subtasks.
