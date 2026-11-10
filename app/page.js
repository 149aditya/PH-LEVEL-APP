'use client';

import { useEffect, useRef, useState } from 'react';
import { phColor, SCALE_GRADIENT, fmt } from '../lib/ph';

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'pH Scan';
const HISTORY_KEY = 'phscan.history';
const CODE_KEY = 'phscan.code';
const MAX_HISTORY = 30;

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This photo could not be opened. Try a different one.'));
    };
    img.src = url;
  });
}

function shrink(img, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

function Scale({ min, max }) {
  const left = (min / 14) * 100;
  const width = Math.max(((max - min) / 14) * 100, 1.5);
  return (
    <div className="scale" role="img" aria-label={`pH ${fmt(min)} to ${fmt(max)} on a scale of 0 to 14`}>
      <div className="scale-strip" style={{ background: SCALE_GRADIENT }}>
        <span className="scale-window" style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
      <div className="scale-ticks" aria-hidden="true">
        <span>0</span>
        <span>7</span>
        <span>14</span>
      </div>
      <div className="scale-ends" aria-hidden="true">
        <span>Acidic</span>
        <span>Neutral</span>
        <span>Alkaline</span>
      </div>
    </div>
  );
}

function Result({ scan, onBack }) {
  const r = scan.result;
  const color = phColor((r.ph_min + r.ph_max) / 2);
  const range = r.ph_min === r.ph_max ? fmt(r.ph_min) : `${fmt(r.ph_min)}–${fmt(r.ph_max)}`;
  return (
    <main className="result" style={{ '--ph': color }}>
      <button className="back" onClick={onBack}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        Home
      </button>

      <div className="photo">
        <img src={scan.photo || scan.thumb} alt={r.name} />
      </div>

      <section className="reading">
        <h1>{r.name}</h1>
        <p className="portion">
          {[r.portion, r.grams ? `about ${r.grams} g` : ''].filter(Boolean).join(', ')}
        </p>

        <div className="ph-line">
          <span className="ph-number">{range}</span>
          <span className="ph-word">
            <i aria-hidden="true" />
            {r.category}
          </span>
        </div>
        <Scale min={r.ph_min} max={r.ph_max} />
        {r.summary && <p className="summary">{r.summary}</p>}
      </section>

      {r.components?.length > 0 && (
        <section className="parts">
          <h2>What is on the plate</h2>
          <ul>
            {r.components.map((c) => (
              <li key={c.name}>
                <i style={{ background: phColor((c.ph_min + c.ph_max) / 2) }} aria-hidden="true" />
                <span>{c.name}</span>
                <b>{c.ph_min === c.ph_max ? fmt(c.ph_min) : `${fmt(c.ph_min)}–${fmt(c.ph_max)}`}</b>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="fineprint">
        Typical values for this kind of food, estimated from the photo. This is not a measurement and not medical advice.
      </p>

      <button className="primary" onClick={onBack}>Scan another</button>
    </main>
  );
}

export default function Page() {
  const [history, setHistory] = useState([]);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [code, setCode] = useState('');
  const [codeDraft, setCodeDraft] = useState('');
  const cameraRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    setHistory(store.get(HISTORY_KEY, []));
    const saved = store.get(CODE_KEY, '');
    setCode(saved);
    fetch('/api/scan')
      .then((r) => r.json())
      .then((d) => setLocked(Boolean(d.locked) && !saved))
      .catch(() => {});
  }, []);

  async function unlock(e) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ check: true, code: codeDraft }),
    }).catch(() => null);
    if (res?.ok) {
      setCode(codeDraft.trim());
      store.set(CODE_KEY, codeDraft.trim());
      setLocked(false);
    } else {
      setError(res ? 'That access code is not right.' : 'No connection. Try again.');
    }
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const img = await loadImage(file);
      const photo = shrink(img, 1024, 0.82);
      const thumb = shrink(img, 220, 0.7);
      setPreview(photo);

      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        store.set(CODE_KEY, '');
        setCode('');
        setLocked(true);
        throw new Error('Enter the access code to scan.');
      }
      if (!res.ok) throw new Error(data.error || 'The scan did not finish. Try again.');
      if (!data.is_food) throw new Error('No food found in this photo. Try a closer shot of the dish.');

      const scan = { id: Date.now(), at: new Date().toISOString(), thumb, result: data };
      const next = [scan, ...history].slice(0, MAX_HISTORY);
      setHistory(next);
      store.set(HISTORY_KEY, next);
      setCurrent({ ...scan, photo });
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message || 'The scan did not finish. Try again.');
    } finally {
      setBusy(false);
      setPreview('');
    }
  }

  function clearHistory() {
    setHistory([]);
    store.set(HISTORY_KEY, []);
  }

  if (current) return <Result scan={current} onBack={() => setCurrent(null)} />;

  return (
    <main className="home">
      <header className="brand">
        <span className="brand-mark" style={{ background: SCALE_GRADIENT }} aria-hidden="true" />
        <span>{BRAND}</span>
      </header>

      {locked ? (
        <form className="gate" onSubmit={unlock}>
          <h1>Enter your access code</h1>
          <p className="lede">You will find it in your invitation.</p>
          <label htmlFor="code">Access code</label>
          <input id="code" value={codeDraft} onChange={(e) => setCodeDraft(e.target.value)} autoComplete="off" autoCapitalize="none" required />
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" type="submit">Continue</button>
        </form>
      ) : busy ? (
        <section className="scanning" aria-live="polite">
          <div className="scanning-photo">
            {preview && <img src={preview} alt="" />}
            <span className="sweep" style={{ background: SCALE_GRADIENT }} />
          </div>
          <p>Reading your photo…</p>
        </section>
      ) : (
        <>
          <section className="hero">
            <h1>How acidic is what you are eating?</h1>
            <p className="lede">Take a photo of your food to see what it is and where it sits on the pH scale.</p>
            <div className="hero-strip" style={{ background: SCALE_GRADIENT }} aria-hidden="true" />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" onClick={() => cameraRef.current?.click()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              Take a photo
            </button>
            <button className="secondary" onClick={() => fileRef.current?.click()}>Choose from gallery</button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onPick} hidden />
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} hidden />
          </section>

          <section className="history">
            <div className="history-head">
              <h2>Your scans</h2>
              {history.length > 0 && <button className="link" onClick={clearHistory}>Clear</button>}
            </div>
            {history.length === 0 ? (
              <p className="empty">Scans you take on this phone show up here.</p>
            ) : (
              <ul>
                {history.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => { setCurrent(s); window.scrollTo(0, 0); }}>
                      <img src={s.thumb} alt="" />
                      <span className="h-name">{s.result.name}</span>
                      <span className="h-ph" style={{ '--ph': phColor((s.result.ph_min + s.result.ph_max) / 2) }}>
                        <i aria-hidden="true" />
                        {fmt(s.result.ph_min)}–{fmt(s.result.ph_max)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
