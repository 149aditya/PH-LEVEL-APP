import { phCategory } from '../../../lib/ph';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Tried in order; a model that no longer exists is skipped.
const MODELS = (process.env.GEMINI_MODEL || 'gemini-3.8-flash,gemini-3.5-flash,gemini-2.5-flash')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const PROMPT = `You are a food scientist. Look at the photo.
If it shows food or drink, identify it and give the typical pH range of that food as served
(use published food pH reference values; for a mixed dish give the overall range and list the main components).
Estimate the visible portion.
If it does not show food or drink, set is_food to false and leave the rest empty or zero.
Keep "name" short (for example "Gulab jamun in syrup"). Keep "portion" short (for example "1 piece" or "1 bowl").
"summary" is one or two plain sentences on why the pH sits where it does. No medical advice.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_food: { type: 'BOOLEAN' },
    name: { type: 'STRING' },
    portion: { type: 'STRING' },
    grams: { type: 'NUMBER' },
    ph_min: { type: 'NUMBER' },
    ph_max: { type: 'NUMBER' },
    summary: { type: 'STRING' },
    components: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          ph_min: { type: 'NUMBER' },
          ph_max: { type: 'NUMBER' },
        },
        required: ['name', 'ph_min', 'ph_max'],
      },
    },
  },
  required: ['is_food', 'name', 'portion', 'grams', 'ph_min', 'ph_max', 'summary'],
};

const clamp = (n) => Math.min(14, Math.max(0, Number(n) || 0));
const json = (body, status = 200) => Response.json(body, { status });

function codeOk(code) {
  const need = process.env.ACCESS_CODE;
  return !need || String(code || '').trim() === need;
}

// Lets the app know whether to ask for an access code.
export async function GET() {
  return json({ locked: Boolean(process.env.ACCESS_CODE) });
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'The request could not be read.' }, 400);
  }

  if (!codeOk(body.code)) return json({ error: 'That access code is not right.', locked: true }, 401);
  if (body.check) return json({ ok: true });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return json({ error: 'GEMINI_API_KEY is not set on the server.' }, 500);

  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image || '');
  if (!m) return json({ error: 'Send a JPEG, PNG or WebP photo.' }, 400);
  if (m[2].length > 4_000_000) return json({ error: 'That photo is too large.' }, 413);

  const payload = {
    contents: [{ parts: [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: PROMPT }] }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
  };

  let lastStatus = 0;
  for (const model of MODELS) {
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(payload),
      });
    } catch {
      return json({ error: 'The scanner could not be reached. Check your connection and try again.' }, 502);
    }
    lastStatus = res.status;
    if (res.status === 404 || res.status === 400) continue; // model retired or unsupported: try the next
    if (res.status === 429) return json({ error: 'The free scan limit is used up for now. Try again in a minute.' }, 429);
    if (!res.ok) continue;

    try {
      const data = await res.json();
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
      const r = JSON.parse(text);
      if (!r.is_food) return json({ is_food: false });

      let lo = clamp(r.ph_min);
      let hi = clamp(r.ph_max);
      if (lo > hi) [lo, hi] = [hi, lo];
      const components = (Array.isArray(r.components) ? r.components : [])
        .slice(0, 5)
        .map((c) => {
          let a = clamp(c.ph_min);
          let b = clamp(c.ph_max);
          if (a > b) [a, b] = [b, a];
          return { name: String(c.name || '').slice(0, 60), ph_min: a, ph_max: b };
        })
        .filter((c) => c.name);

      return json({
        is_food: true,
        name: String(r.name || 'Food').slice(0, 80),
        portion: String(r.portion || '').slice(0, 40),
        grams: Math.max(0, Math.round(Number(r.grams) || 0)),
        ph_min: lo,
        ph_max: hi,
        category: phCategory(lo, hi),
        summary: String(r.summary || '').slice(0, 400),
        components: components.length > 1 ? components : [],
      });
    } catch {
      continue;
    }
  }

  return json({ error: `The scan did not finish (code ${lastStatus || 'unknown'}). Try again.` }, 502);
}
