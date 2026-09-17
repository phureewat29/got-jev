# Scene backdrops

One 16:9 backdrop per place, shown full-bleed behind the story and crossfaded when Jev's
`location` judgment moves. 70 images: 56 locations, 13 regions (used while travelling, when
no single place applies) and one `default`.

The app resolves them in `src/core/Background.ts`, falling back from a location to its parent
place, then its region, then `default` — so a missing image degrades rather than blanks.

## Provenance

Generated on 2026-09-17 with **`google/gemini-3-pro-image`** ("Nano Banana Pro") through the
OpenRouter images endpoint, at `aspect_ratio: "16:9"`, then downscaled to 1600px wide and
encoded with `cwebp -q 72`. 70 images, **$9.02** total (about $0.135 each), 3.9 MB on disk.

These are machine-generated, so no third-party licence attaches to them. They depict places
from George R. R. Martin's *A Song of Ice and Fire*; this project is a non-commercial
technical demonstration.

## Prompt recipe

Each prompt is a subject line followed by one shared style block. The subject comes straight
from the catalog — `name`, `region`, and the first sentence of that entry's `description` in
`src/core/data/locations.ts`, which is reliably the physical description rather than plot.
Regions use hand-written travel views (an open road, wilderness, a coast) instead of a
landmark, because they stand in for being *between* places.

The style block, appended verbatim to all 70, is what makes the set cohere:

> Wide cinematic establishing shot, matte digital painting in the style of high-fantasy
> concept art. Muted desaturated earth palette, heavy atmosphere and haze, dramatic natural
> light, painterly visible brushwork, deep depth of field. Unpopulated — no people or
> creatures in the foreground. Absolutely no text, no lettering, no captions, no watermark,
> no signature, no logo, no border or frame. Landscape 16:9.

A style reference image was not needed; the block alone held the look across snow, canals and
desert. The images are deliberately left bright — the darkening for legibility is done in CSS
by the scrim in `.backdrop-scrim`, not baked into the artwork.

## Replacing them

Any 16:9 image named after a catalog id works — drop `<id>.webp` in this directory and
nothing else changes. The generator itself was throwaway and is not part of the repository;
the recipe above is enough to rebuild it.
