# Onboarding illustrations — first concept

Generated with the built-in imagegen tool, then resized to 640 pixels wide and encoded as WebP with `scripts/prepare-onboarding-art.mjs`. No CLI image-generation API was used. Original generated PNGs remain outside the repository; all app-consumed assets are here and included in the offline precache.

Final assets: `welcome-v1.webp`, `history-v1.webp`, `estimates-v1.webp`, `window-v1.webp`, `privacy-v1.webp`.

## Prompt set

Character anchor: friendly abstract teal sea otter sitting upright and gently waving; rounded silhouette, small expressive dark eyes, pale teal muzzle and belly, reassuring smile. Deep teal #087b80, light teal #bce5dd, small coral #ee806e accents. Mature yet approachable; no baby styling, eyelashes, clothing, text, numbers, logo, or watermark. Clean vector-like filled shapes, minimal shading. The initial transparent-background attempt had an unwanted dark glow and was not shipped.

Final scenes referenced the same character, preserving its face, proportions, palette, and illustration style. Each requested a plain warm ivory #fbf8f7 background, no glow or dark background, landscape framing, full character with margins, no text or watermark:

- Welcome: waving one paw, no calendar or other prop.
- History: beside a simple calendar, pointing to a group of coral days.
- Estimates: thoughtfully holding a circular cycle diagram with a short coral segment and teal remainder.
- Pre-period window: beside three golden calendar tiles leading to two coral tiles.
- Privacy: holding a closed coral journal with a small teal padlock.

The illustrations are decorative; every instruction is localized HTML text, not embedded in an image.
