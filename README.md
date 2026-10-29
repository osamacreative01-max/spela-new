# SEPELA — cocktail can website

Static, single-page marketing site for the SEPELA cocktail-can range
(Pink Gin & Tonic, Rum & Ginger and Lime, Whisky & Cola).

No build step, no framework — plain HTML, CSS and JavaScript.

```
index.html            the whole page (head meta, sections, footer)
css/style.css         all styles, responsive + reduced-motion rules
js/main.js            three.js can scene, scroll engine, age gate, menu
js/textures.js        AUTO-GENERATED can labels (base64 data URLs)
js/vendor/            three.js + RoomEnvironment
assets/               logos, can renders, labels, icons, OG image
make-textures.ps1     regenerates js/textures.js
_gencan.html          can-render helper page — do NOT deploy
sepela/               older Next.js version of this site — not used
```

## Local preview

The page can be opened straight from disk, but a local server is closer to
production (correct MIME types, no `file://` quirks):

```powershell
# any static server works, e.g.
npx serve .
# or
python -m http.server 8099
```

Then open <http://localhost:8099/>.

## Editing content

**Flavours, prices, copy** — all live in `index.html`. The carousel cards and
the "Crafted in Poland" blocks are plain markup; edit the text, `alt`
attributes, chip labels and prices directly.

The 3D can uses the same three flavours from the `FLAVORS` array at the top of
`js/main.js`. Each entry needs:

| key     | meaning                                                    |
| ------- | ---------------------------------------------------------- |
| `label` | label texture used by WebGL (see texture workflow below)    |
| `can`   | transparent WebP render used for cards / no-WebGL fallback  |
| `faceU` | horizontal UV offset that centres the artwork on the can    |
| `short` | word shown in the big scroll headline (`Go wild with …`)    |
| `name`  | full product name                                           |
| `rgb`   | accent colour for the WebGL scene lighting                  |

Keep `faceU` roughly centred on the artwork; small tweaks shift the label left
or right around the can.

The hero shows all three cans side by side (the centre one is `HERO_FLAVOR`,
currently Whisky & Cola). The two side cans are generated from the same
`FLAVORS` entries and fade out as the dive begins, leaving the active flavour
alone for the scroll sequence.

**Stockists / trade contact** — the `#find` block in the footer is placeholder
copy. Replace it with real stockist and trade-contact details before launch.

**Social preview** — `assets/og-cover.jpg` (1200×630) is referenced by the
`og:image` / `twitter:image` tags. Those URLs are relative; make them absolute
(`https://your-domain/...`) once the live domain is known, or link previews
will not render.

## Can label textures

WebGL cannot upload images from `file://`, so the labels are embedded in
`js/textures.js` as base64 `data:` URLs. That file is generated — never edit it
by hand.

1. Put the full-resolution artwork in `assets/label-*.jpg`.
2. Resize a web copy (1200 px wide) into `assets/tex/label-*.jpg`.
3. Regenerate the embedded textures:

```powershell
powershell -ExecutionPolicy Bypass -File make-textures.ps1
```

The script prints the new file size. Expect roughly 340 KB for all three
labels; going much above that means the JPEGs were saved at too high a quality.

## Can renders

`assets/can-*.webp` are the transparent can images used in the cards, the craft
parallax blocks and the no-WebGL fallback. The original PNGs are kept as
masters but are not referenced by the page. If you replace a render, export a
WebP around 1000–1100 px tall (~50–60 KB) and update the `width`/`height`
attributes in `index.html` if the aspect ratio changes.

## Age gate

The 18+ gate stores the visitor's choice in `localStorage` under `sepela-age`.
To see it again during testing, run this in the browser console:

```js
localStorage.removeItem('sepela-age');
location.reload();
```

Everything behind the gate is made `inert` while it is open, and the page
scroll is locked.

## Deploying

Upload the repository root minus the `sepela/` folder (old Next.js copy) and
`_gencan.html` (development helper). The site needs no server-side runtime —
any static host or CDN works.

Before going live:

- [ ] Replace the placeholder `#find` stockist / trade copy.
- [ ] Make the `og:image` / `twitter:image` URLs absolute.
- [ ] Check the JSON-LD price/currency in `index.html` matches the real RRP.
- [ ] Confirm the licence/attribution for the vendor three.js build if required.
