# Honeyville assets

Original assets created for Model Simulator Batch 2, licensed under the adjacent MIT LICENSE.txt. Regenerate deterministically with `npm run world:generate` from the frontend root. Editable sources are SVG plus `scripts/generate-honeyville.mjs`; no external image service or art pack is required.

| Asset | Role |
|---|---|
| terrain.svg | 256×64 atlas, sixteen 32×32 terrain/road/flower/water/hedge tiles |
| bee.svg | 512×256 sheet; 4 directions × 8 frames, each 64×64 |
| market.svg | Honey Market |
| factory.svg | Production Factory |
| hive.svg | Residential Hive |
| government.svg | Government Building |
| square.svg | Public Square fountain |
| field.svg | Nectar Field |
| tree.svg | Reusable environmental tree |

Buildings are 256×256 except tree.svg (128×160). Scene placement/size comes from `src/features/world/honeyville.json`, not these asset files. The rendered map is an original finite, orthogonal Tiled-compatible JSON level, not a static illustration. Static art does not represent authoritative inventory, production or resource quantities.

Phaser 4.2.1 is MIT-licensed (phaserjs/phaser/LICENSE.md); its React TypeScript template is an architectural reference, not a replacement application. Playwright is Apache-2.0-licensed and development-only. Their package notices remain in installed dependencies. Engine code and unrelated application code are not covered by this asset license.
