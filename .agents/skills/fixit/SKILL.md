---
name: fixit
description: Run health checks and fix problems. Checks if the dev server is running, runs lint and build checks, verifies file integrity, and automatically fixes any issues found.
---

# $fixit — fix problems

## before you touch anything

stop and think:
- what was the user doing when this broke? read the recent conversation.
- what changed recently? look at the last few file modifications.
- what are you assuming is fine that might not be?
- don't just chase the first error you see — is it the root cause or a symptom?

bugs live where the thinking stopped too soon. the obvious fix isn't always the right one. trace the problem back to where it actually started.

## diagnostic checklist

run through this diagnostic checklist. **stop and fix at the first failure** before moving on.

## 1. Dev Server Running?

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

If it's not responding:
```bash
npm run dev &
```
Wait for it to come up, then continue. If the background process fails to hold, try starting it again with `npm run dev &`. If it still fails, check `npm run build` for errors — the dev server likely can't start because of a build error. Fix the build error first, then retry the dev server.

## 2. File Integrity

Verify these files exist and are valid:
- `app/page.tsx` — has a default export
- `app/layout.tsx` — has a default export, wraps children in `<Providers>`
- `app/providers.tsx` — exports `Providers` component with `HeroUIProvider`
- `app/globals.css` — has `@import "tailwindcss"`, `@plugin '../hero.ts'`, `@custom-variant dark`, and a `@theme` block
- `hero.ts` — has a default export from `heroui()`

If any are missing or broken, recreate them with these essentials:
- `app/page.tsx` — must have `"use client"` at top and a default export component
- `app/layout.tsx` — must import `Providers` from `./providers`, wrap `{children}` in `<Providers>`, have `suppressHydrationWarning` on `<html>`
- `app/providers.tsx` — must have `"use client"`, import `HeroUIProvider` from `@heroui/react`, export `Providers` wrapping children in `<HeroUIProvider>`
- `app/globals.css` — must have `@import "tailwindcss"`, `@plugin '../hero.ts'`, `@source '../node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'`, `@custom-variant dark (&:is(.dark *))`, and a `@theme` block with `--font-sans: var(--font-geist-sans), system-ui, sans-serif` and `--font-mono: var(--font-geist-mono), monospace`
- `hero.ts` — must `import { heroui } from "@heroui/react"` and `export default heroui()`

## 3. Import Check

Scan files in `app/` and `components/` (if it exists) for imports. Check that:
- All `@heroui/react` imports are valid
- No imports from missing local files
- No imports from packages not in `package.json`

Fix any broken imports.

## 4. Lint Check

```bash
npx eslint app/ --fix
```

The `--fix` flag auto-corrects what it can. If errors remain after `--fix`, they need manual fixes — read the errors, edit the code, and re-run to confirm. Don't show raw lint output to the user.

## 5. Build Check

```bash
npm run build
```

If the build fails, read the errors, fix them, and run the build again. Translate any errors to plain language for the user.

## after fixing

tell the user in plain language what was wrong and that it's fixed:
> "found a small issue — [description]. fixed it up, you're good now. check your browser."

## if everything passes

> "everything looks good — your app is running clean."

## if the checklist passes but something still feels wrong

don't stop. the checklist catches common problems, not all problems.

- re-read the user's last few messages. what exactly are they seeing?
- open the files they were working on. read them fresh, like you've never seen them.
- check if the logic actually does what the user expects, not just what the code says.
- look for subtle issues: wrong variable, off-by-one, state not updating, component not re-rendering.
- if you've tried 3 things and it's still broken, step back. re-read everything from scratch.

if you truly can't find the issue after digging:
> "hey — i ran through everything and it all looks clean on my end. can you tell me exactly what's happening? like what do you see vs what you expected?"

then work from their description to find the real problem.

## rules

- never show raw error output, terminal logs, or stack traces
- fix problems, don't just report them
- if you fix something, confirm it's actually fixed before telling the user
- keep it casual — "found a typo in an import" not "ESLint rule import/no-unresolved violation"
- don't stop at "it compiles" — verify it actually works the way the user expects
- if your fix might have introduced a new problem, check for that too
