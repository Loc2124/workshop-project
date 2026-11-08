These original WOFF2 files are self-hosted for Open Slot. Each file is unchanged
from the upstream Google Fonts normal-style download captured on 2026-11-03;
the filename includes the first 12 characters of its SHA-256 hash.

| Upstream family | Version | Advertised CSS weights | Subsets           |
| --------------- | ------- | ---------------------- | ----------------- |
| Lora            | v37     | 500–700 variable       | Latin, Vietnamese |
| Open Sans       | v44     | 400–700 variable       | Latin, Vietnamese |
| Source Code Pro | v31     | 400 static             | Latin, Vietnamese |

Only these CSS weight ranges are exposed. Upstream variable binaries are kept
intact, including their internal variation data, to preserve the existing glyph
outlines and metrics. No reserved font name or upstream font file was modified.
The monospace font is used only by the audit JSON view and is not preloaded.

Sources and licenses:

- [Lora upstream](https://github.com/google/fonts/tree/main/ofl/lora),
  [SIL OFL](../../apps/web/public/fonts/lora-OFL.txt).
- [Open Sans upstream](https://github.com/google/fonts/tree/main/ofl/opensans),
  [SIL OFL](../../apps/web/public/fonts/open-sans-OFL.txt).
- [Source Code Pro upstream](https://github.com/google/fonts/tree/main/ofl/sourcecodepro),
  [SIL OFL](../../apps/web/public/fonts/source-code-pro-OFL.txt).

`manifest.json` records each file's SHA-256, size, CSS Unicode range, and fallback
metrics. Local fallback metrics were calculated from normalized advance widths
of a Latin/Vietnamese sample and the target font's typographic ascender,
descender, and line gap, using Arial/Arial Bold, Georgia/Georgia Bold, and Consolas.
If those local fonts are unavailable, the final generic fallback still applies.

When replacing a font, preserve its license and generate a new fingerprinted
filename. Update `styles.css`, the two Latin preloads in `index.html`, and this
manifest together. Production Vercel caches `/fonts/*` for one year as immutable;
never overwrite the contents of an existing fingerprinted filename.
