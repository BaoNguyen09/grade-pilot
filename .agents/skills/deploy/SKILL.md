---
name: deploy
description: Deploy the app to the internet and get a shareable link. Triggers on "$deploy", "deploy my app", "push this live", "put it on the internet", or any deployment request. Handles build verification, deployment to Vercel, and guides the user through sharing their creation.
---

# $deploy — put it on the internet

## pre-deploy

run the build first:
```bash
npm run build
```

if it fails, fix the errors (translate to plain language), rebuild, confirm it's clean.

tell the user: "putting your app on the internet — give me a sec." if it takes a moment: "still going — almost there."

## deploy

run the deploy script:

```bash
bash .agents/skills/vercel-deploy/scripts/deploy.sh
```

this deploys without needing a vercel account. capture the preview URL from the output (looks like `https://project-xxxxx.vercel.app`).

## share the link

> "GradePilot is live. here's your link:"
> "[Preview URL]"

if the output includes a `claimUrl`, mention it once:
> "that link works right now for anyone. if you want to keep it permanently, you can claim it at [claimUrl] with a free account — totally optional."

> "want to update the live version? just say deploy again."

## if it fails

don't panic. fix inline:
1. check for build errors and fix them
2. check dev server is running
3. retry the deploy

translate all errors to plain language. never show raw logs.

## re-deploy

same flow: build check → deploy → share updated URL.
> "want me to update the live version? just say deploy again."

## rules

- always run `npm run build` before deploying
- never show raw build or deployment output
- keep it concise — share the link, mention claim URL if present
- the claim URL is optional — don't make it feel required
