# Player Showcase: token links

Anyone with the generated link can open the published showcase without an account or password. Only selected games and clips are published. New content stays private until selected and published.

## Install
In your hockey-ops folder:

```bash
unzip -o ~/Downloads/hockey-ops-token-link-update.zip -d .
```

If you installed the earlier password version, remove its unused action file:

```bash
rm -f 'src/app/showcase/[token]/actions.ts'
```

In Supabase SQL Editor:
1. If not already applied, run `supabase/migrations/20261025010000_player_showcase.sql`.
2. Run `supabase/migrations/20261025020000_showcase_token_links.sql`.

Both require your existing player-sharing migration. Do not re-run migrations already applied. The second migration disables any old password-protected showcase and rotates its token. Republish to create an open share link.

Run `npm run build`, then deploy using your usual process.

## Use
Open Player Summary → Player Showcase. Enter optional player details, select completed games and clips, then Publish Showcase. Copy the link to share it.

- Publish creates a new link and snapshot; previous links stop working.
- Replace Link rotates just the link and preserves the currently published content.
- Disable Sharing prevents future opens. Already viewed or copied content cannot be recalled.
- The editor starts fresh each visit rather than restoring saved selections/profile fields. Replace Link does not require re-entering those details.
- Random UUID links are unlisted; no public list is exposed. Noindex discourages search indexing. Anyone who receives or is forwarded the link can view it.
- Videos open on their original host and retain that host's access rules.
- No new environment variables or service-role keys are needed.

## Validation
TypeScript, lint and snapshot privacy/statistics checks passed. Production build validated using placeholder Supabase settings, since credentials are absent from the uploaded source. Live database testing remains necessary: publish, open in a private browser without login, replace the link and confirm the previous link fails, then disable and confirm the new link fails. Confirm non-parent accounts cannot manage links.
