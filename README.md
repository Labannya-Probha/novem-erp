# emotet-malware-killer
## Use at your own risk
This software utilizes autorunsc to check processes and services against Virus Total, if it reaches the set threshold it will auto-nuke the malware.

## Team editor note (Tailwind CSS)

This repository includes workspace-level VS Code settings in `.vscode/settings.json` to avoid false CSS diagnostics for Tailwind directives such as `@tailwind` and `@apply`.

- If you open this repo in VS Code, these settings are applied automatically.
- Please keep this file committed so the whole team sees the same lint behavior.

## Supabase setup — required steps

### 1. Database migrations

Run all SQL files in the `migrations/` directory in numbered order against your Supabase project (SQL Editor → New query or via Supabase CLI).

Migration `010_ensure_handle_new_user_trigger.sql` is critical: it creates the `handle_new_user` trigger that links every new `auth.users` record to a matching row in `public.app_users`.

### 2. Edge Functions

The staff-creation flow uses a Supabase Edge Function that bypasses the public sign-up restriction (recommended to keep disabled for ERP systems).

Deploy the functions with the Supabase CLI:

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-reset-password
```

Or deploy them from the Supabase Dashboard → Edge Functions.

**Required secrets** (set in Dashboard → Edge Functions → Secrets, or via CLI):

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by Supabase.

### 3. Authentication settings

- **Disable public sign-ups** — Authentication → Providers → Email → disable "Enable email sign-ups". All accounts are created by admins through the Settings → Staff Management screen.
- **Enable Leaked password protection** — Authentication → Providers → Email → enable "Leaked password protection".

### 4. SSH & GPG key setup (Git)

Add your SSH key to GitHub:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

Then add the printed public key in GitHub → Settings → SSH and GPG keys.

Add your GPG key for signed commits:

```bash
gpg --full-generate-key
gpg --list-secret-keys --keyid-format=long
gpg --armor --export <YOUR_KEY_ID>
git config --global user.signingkey <YOUR_KEY_ID>
git config --global commit.gpgsign true
```

Then add the exported public key in GitHub → Settings → SSH and GPG keys.
