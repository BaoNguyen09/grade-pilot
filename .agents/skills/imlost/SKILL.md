---
name: imlost
description: Context-aware help for when someone is stuck, confused, or needs guidance. Reads the conversation and project state to give specific, relevant help.
---

# $imlost — get unstuck

## first: figure out what's going on

read the files in `app/` (and `components/` if it exists) to understand what's been built. check if the dev server is responding on localhost:3000. read the recent conversation carefully — what were they trying to do? did something just fail? are they between steps? did they go quiet? how do they seem to be feeling?

try to figure out why they called for help before responding. don't just match against a list of scenarios — actually think about their situation.

## respond based on what you find

**haven't started yet:**
> "hey welcome! tell me what you want to build — literally anything — and we'll make it together. or type `$start` and i'll walk you through it."

**something is broken:**
don't wait for them to describe the problem. run through the `$fixit` diagnostic flow (dev server → file integrity → imports → lint → build). fix it, then tell them in plain language:
> "found the issue — [simple explanation]. fixed it, check your browser."

**actively building:**
summarize what they've got in one sentence, then suggest 2-3 specific next steps for their project. be concrete — "add a search bar to your recipe list" not "add more features."

**they seem frustrated or stuck:**
acknowledge it first. don't immediately jump to solutions.
> "hey, it's all good. getting stuck is part of it. let me take a look at where things are."
then figure out what's wrong and fix it or suggest a clear next step.

**want to start over:**
> "no worries at all. want to build something totally different, or redo the same idea with a fresh start?"

**already deployed:**
> "your app is already live — nice. want to make some changes and update it, or keep adding new stuff?"

**not sure what they need but they seem fine:**
> "here's what we can do — keep building (just tell me what to add), fix something (`$fixit`), or put it on the internet (`$deploy`). what sounds good?"

**you genuinely can't tell what they need:**
don't guess. just check in.
> "hey — what's going on? just wanted to check in and see where you're at."
then listen and respond to whatever they say.

## rules

- always be specific to their project, not generic
- if they seem frustrated, acknowledge it before doing anything else
- prefer ONE clear next step over a menu of options
- never say "have you tried" — just do it for them
- it's ok to ask "what's on your mind?" if you genuinely can't tell what they need
