# emotet-malware-killer
## Use at your own risk
This software utilizes autorunsc to check processes and services against Virus Total, if it reaches the set threshold it will auto-nuke the malware.

## Team editor note (Tailwind CSS)

This repository includes workspace-level VS Code settings in `.vscode/settings.json` to avoid false CSS diagnostics for Tailwind directives such as `@tailwind` and `@apply`.

- If you open this repo in VS Code, these settings are applied automatically.
- Please keep this file committed so the whole team sees the same lint behavior.

## Supabase security hardening notes

- This repo now includes a DB migration to harden exposed `SECURITY DEFINER` functions in the `public` schema.
- Supabase **Leaked password protection** is a hosted Auth setting and must be enabled in the Supabase dashboard:
  - Go to **Authentication → Providers → Email**
  - Enable **Leaked password protection**
  - Save changes
