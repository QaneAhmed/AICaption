## AI Caption Coach

Generate scroll-stopping social captions or short, polished bios from one simple page. Upload an image for caption drafts that include hashtag lines, or switch to Bio mode and let the guidance text become the voice of your profile.

### Features
- **Mode switch**: choose `Captions` (image + optional guidance) or `Bio` (text only).
- **Guidance / About field**: directs caption tone or fuels the bio copy.
- **Tone & max characters**: four tone presets with an optional 40–220 character limit.
- **Results**: captions return five variants with hashtag lines; bios return three copy options, each with quick copy buttons.
- **OpenAI-powered**: a single `/api/captions` route branches per mode, enforces schema, retries once, and provides safe fallbacks.

### Prerequisites
- Node.js 18+
- An OpenAI API key with access to `gpt-4o-mini` (or adjust in `src/app/api/captions/route.ts`).

Create a `.env.local` in the project root:

```bash
OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

### Local Development
Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to use the app.

### Validation Rules (UI & API)
- **Captions mode**: image (JPG/PNG ≤ 3 MB) and tone required; guidance optional up to 280 chars; optional max characters (40–220).
- **Bio mode**: guidance/About text required (10–400 chars); tone optional (defaults to Classy); optional max characters (40–220).

### Project Structure Highlights
- `src/app/page.tsx` – marketing header + form container.
- `src/components/caption-coach-form.tsx` – client form, validation, result rendering, clipboard copy.
- `src/app/api/captions/route.ts` – multipart handler, OpenAI prompts, schema validation, fallbacks.

### Deployment
Deploy to any Next.js-ready host (e.g., Vercel). Ensure `OPENAI_API_KEY` is configured in the target environment.
