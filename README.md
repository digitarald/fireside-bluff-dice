# Schummelmäx – Mäxchen am Lagerfeuer

Mäxchen (Meiern, Mäxle, Schummelmäx) als 3D-Spiel für ein Handy, das in der Runde herumgereicht wird.

**Ablauf:** Würfeln → heimlich unter den Becher schauen → Wert ansagen (wahr oder gelogen, immer höher als die letzte Ansage) → verdeckt weitergeben. Der Nächste glaubt und würfelt selbst – oder deckt auf. Wer im Unrecht war, bekommt einen Strafpunkt (bei Mäxchen zwei) und eröffnet die nächste Runde. Nach einem geglaubten Mäxchen geht nur noch Mäxchen.

**Rangfolge:** Mäxchen (21) › Pasch 66 … 11 › 65, 64 … 31.

**Variante:** „Blind nachwürfeln“ (in den Regeln einschaltbar) – einmal pro Zug nach dem Anschauen neu würfeln und unbesehen ansagen.

Spielen: https://digitarald.github.io/fireside-bluff-dice/ – „Zum Home-Bildschirm“ hinzufügen, dann läuft es auch offline.

## Akku

Volle Bildrate nur, während sich etwas bewegt; im Leerlauf ~30 fps; nach einer Minute ohne Berührung oder hinter einem Overlay stoppt das Rendern ganz (Ton pausiert mit). Schatten werden nur neu berechnet, wenn Becher oder Würfel sich bewegen.

## Entwickeln

```
npm install
npm run build   # bündelt src/game.js + three.js zu game.min.js
```

Bei Änderungen `CACHE_NAME` in `service-worker.js` hochzählen.
