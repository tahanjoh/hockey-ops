# Showcase photos and league stats links

This update builds on the installed token-link showcase. No new SQL or environment variables are needed.

## Install
From your hockey-ops folder:

```bash
unzip -o ~/Downloads/hockey-ops-showcase-media-update.zip -d .
node scripts/testShowcase.cjs
npm run build
```

## Use
Open Player Summary → Player Showcase.

- Under Player hero photos, upload a JPG, PNG or WebP photo. Up to two photos are supported. HEIC must first be exported as JPG.
- Photos resize automatically. Add an alternate, use Make hero image to choose the first photo, or remove/re-upload to replace one. Visitors can switch between both photos on the card.
- Add up to eight leagues, each with its name and an HTTPS link to that player's league stats page. Links open in a new tab; stats are not imported automatically.
- Current published profile details, photos and leagues load when reopening the editor. Re-select the games and individual clips you want included before publishing.
- Publish Showcase to save the changes. Publishing creates a new share link, as before. Copy and share that new link. Replace Link alone preserves the existing published content.
- Photos are stored in the selected showcase snapshot; no public upload bucket is needed. Previously published showcases without photos or leagues still work.

## Commit after checks pass

```bash
git add SHOWCASE_MEDIA_UPDATE.md scripts/testShowcase.cjs src/lib/hockey/showcase.ts src/lib/hockey/showcaseMedia.ts 'src/app/players/[id]/showcase' 'src/app/showcase/[token]/Viewer.tsx'
git commit -m "Add showcase hero photos and league stats links"
git push origin main
```

## Validation
TypeScript, lint, snapshot privacy/statistics tests, image/league validation tests and production build checked locally. Build uses placeholder Supabase settings because credentials are not supplied. Verify live photo upload, publishing, visitor photo switching, external league links, and saved editor values after deployment.
