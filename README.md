# pH Scan

Photograph food, get what it is, the portion, and its typical pH range.
Next.js app with one server route that calls the Gemini API. Scan history is kept on the user's phone.

## Deploy for free

1. **Gemini key**: sign in at https://aistudio.google.com, tap "Get API key", create a key. No card needed.
2. **GitHub**: create a new repository and upload everything in this folder.
3. **Vercel**: at https://vercel.com choose "Add New > Project", import the repository.
4. Under "Environment Variables" add `GEMINI_API_KEY` with your key. Optionally add the others below.
5. Deploy. You get a `your-name.vercel.app` link.

## Settings (environment variables)

| Name | Needed | What it does |
|---|---|---|
| `GEMINI_API_KEY` | yes | Your Gemini API key |
| `NEXT_PUBLIC_BRAND_NAME` | no | Name in the header (white-label per client). Redeploy after changing. |
| `ACCESS_CODE` | no | If set, users must enter this code before they can scan |
| `GEMINI_MODEL` | no | Comma-separated model names, tried in order |

## Run on a computer

```
npm install
cp .env.example .env.local   # then fill in GEMINI_API_KEY
npm run dev
```

## Good to know

- The pH is the typical published range for the identified food, not a measurement.
- Free Gemini usage has per-minute and per-day limits (see your limits in AI Studio), and Google may use
  free-tier requests to improve its products. Switch the key to a paid project before a client rollout.
- Vercel's free Hobby plan is for non-commercial use. Fine for a demo; move to Pro once a client pays.
