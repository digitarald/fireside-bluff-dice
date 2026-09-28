# Fireside Bluff

A 3D dice-bluffing game for playing around the fire on one shared phone.

Shake a leather cup on a tree stump, slam it down, and decide: **Reveal**, **Roll** again, or **Pass** it on hidden. Built with three.js — firelit shadows, drifting embers, tilt parallax, shake-to-roll, synthesized dice sounds and fire crackle, haptics, and a special celebration for Mia (2·1).

Play: https://digitarald.github.io/fireside-bluff-dice/ — "Add to Home Screen" to install it as an offline app.

## Battery

The renderer only runs at full rate while something is moving, drops to ~30fps when idle, and stops entirely after a minute untouched or while a sheet covers the table (audio suspends too). Shadows re-render only when the cup or dice move, and pixel ratio is capped on phones.

## Develop

```
npm install
npm run build   # bundles src/game.js + three.js into game.min.js
```

Bump `CACHE_NAME` in `service-worker.js` when shipping changes.
