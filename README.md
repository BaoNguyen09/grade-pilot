# GradePilot

plan your classes by semester, model weighted grade categories, and estimate your best‑case term GPA.

## features

- semesters → classes → categories → items
- weighted grading (with optional “drop lowest” per category)
- drag to reorder items inside a category
- autosave (localStorage)
- optional syllabus ingest (Gemini) with a local fallback parser

## run locally

```bash
npm install
npm run dev
```

then open `http://localhost:3000`.

## optional: enable AI syllabus ingest (Gemini)

the app can call two API routes to extract grading categories from syllabus text / PDFs:
- `POST /api/ingest-syllabus`
- `POST /api/ingest-syllabus-file`

to enable that, create a `.env.local`:

```bash
GEMINI_API_KEY=your_key_here
# optional
GEMINI_MODEL=gemini-3-flash-preview
```

### privacy note

if you use “autofill with syllabus”, your syllabus text/PDF is sent to Google’s Gemini API for parsing. if you don’t want that, you can keep using the app without a key and it will fall back to a local parser.

## deploy

GradePilot is a Next.js app and deploys cleanly on Vercel.
