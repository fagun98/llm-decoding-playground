# Screenshots

Real screenshots captured from the production build (`npm run build && npm run preview`) with DistilGPT2 loaded in Chromium:

| File | Contents |
|------|----------|
| `screenshot-main.png` | Full UI with Temperature / Top-k / Top-p set so some candidates are filtered |
| `screenshot-filtered.png` | Close-up of the probability bars with greyed / struck-through filtered tokens |
| `screenshot-comparison.png` | Greedy vs balanced vs high-temperature continuations |

Regenerate with:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
node scripts/capture-screenshots.mjs
```
