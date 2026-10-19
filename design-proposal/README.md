# Alternate UI design proposal — Spotify design system

Static mockup (`index.html`, open directly or serve with `python -m http.server`).
Generated with the `popular-web-designs` skill (`templates/spotify.md`). **Not wired into the app** —
if approved, implementation goes to Codex per the usual flow.

## Why Spotify for a card league
- The current site is a mythicspoiler-style dense grid; this proposal keeps the dark immersion
  but introduces a real design system: near-black surfaces (`#121212`–`#252525`), DM Sans
  compact type (10–28px), pill geometry, heavy elevation shadows.
- **Album-art-driven = card-art-driven**: Spotify's "UI stays achromatic, content provides color"
  maps 1:1 to MTG card art. Green (`#1ed760`) is reserved for functional states only
  (owned / active / primary) — the same slot mana-color dots already occupy visually.

## Component mapping (proposal → app)
| Proposal element | App counterpart |
|---|---|
| Sidebar nav (Collection / Decks / Analytics / Matches) | app sections + player list |
| Card rows per color group | WUBRG grouped gallery (kept, restyled tiles) |
| Green circular `+` on hover | click-to-toggle owned |
| Dimmed tile (opacity .3 + grayscale) | not-owned state |
| Shortcut tiles w/ hover play button | decks & recent imports |
| Bottom "now playing" bar | selected-card state + deck build actions |
| Stat cards (Completion / Mythics / Record / Decks) | `/analytics` summary |
| Match feed rows | `/matches` list |
| Pill search + Import & merge | existing toolbar, restyled |

## Deliberate deviations from current UI
- Card tiles are larger (172px) with hover-revealed actions instead of always-on steppers.
- Owned counter moves to a sticky top pill; group headers show `owned / total`.
- Rarity shown as a small gem + capitalize badge on the art (replaces corner gem only).
