# Agent output conventions

## Console commands

- Always format console commands so they can be copy-pasted and run as-is.
- Use plain language. Include a few words of description with function names.
- Put every command in a fenced code block with a language hint (`bash, `sh, ```powershell).
- No leading prompt characters (`$`, `>`, `PS>`) — they break paste.
- No inline prose or `# ...` explanations on the command line; keep commentary in surrounding text or on their own comment lines inside the block.
- Format output in structured form when appropriate.
- Never wrap a command with hard line breaks that alter it; use the shell's own line continuation (`\` for bash, backtick for PowerShell) if a command must span lines.
- Match the reader's shell (this project: PowerShell primary, Git Bash available) and keep paths/quoting valid for it.
