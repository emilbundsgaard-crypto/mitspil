# Squad Rush

An endless wave runner-shooter for the browser. Lead a squad of soldiers up the road, pick the right gates, blow up barrels for loot, survive boss fights every 5 waves and spend your coins in a massive tech tree when you fall.

**Play:** https://emilbundsgaard-crypto.github.io/mitspil/

## Controls
- Move: mouse, touch-drag, `A`/`D` or arrow keys
- Airstrike: `Space` · Nuke: `N` (unlocked in the tech tree)
- Pause: `P` / `Esc`

## Features
- Endless waves, every wave is a level, a boss every 5th wave
- 18 weapons, from pistol and revolver to minigun, bazooka, tesla gun and plasma cannon, each with its own 3D model
- Gates (+, ×, −, ÷) that you can shoot to improve, and barrels with loot
- Difficulties: Easy, Medium, Hard, Impossible
- A large tech tree: squad size, firepower, weapons, economy, gates, defense, abilities and wave skips
- Progress is saved in your browser (localStorage)

## Running locally
No build step is needed. Serve the folder with any static server:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

Built with [three.js](https://threejs.org) (vendored in `vendor/`, MIT licence).
