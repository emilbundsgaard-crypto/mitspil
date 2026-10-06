# Squad Rush module API (contract between main.js and feature modules)

The game is plain ES modules + three.js r160 (import map: `three` -> `./vendor/three.module.min.js`,
addons in `./vendor/addons/`). No build step. Coordinates: the road runs along z, width x ∈ [-5.2, 5.2]
(`G.ROAD_HALF`). The squad stands around `z = G.SQUAD_Z (4)`; enemies/props spawn at `z = G.SPAWN_Z (-112)`
and move toward +z. The world "scrolls" by moving objects +z at `G.S.speed` units/s (0 while a boss holds the world).
Camera looks down the road toward -z. Units/meshes face -z for the player side, +z (yaw = PI) for enemies.

`main.js` builds one object `G` and passes it to every module function.

## G (provided by main.js)
Constants: `G.THREE`, `G.scene`, `G.SQUAD_Z`, `G.ROAD_HALF`, `G.SPAWN_Z`, `G.models` (all exports of models.js)

State: `G.S` (current run state; `null` outside a run). Readable fields:
- `wave`, `time` (s since run start), `speed` (world scroll speed), `dist`
- `squadX`, `frontZ` (z of front of squad), `radius` (squad radius)
- `allies` (array of `{x, z}`), `enemies` (array of `{type,x,z,hp,maxHp,r,s,speed,dead}`)
- `boss` (current boss object or null), `buffs` (object: name -> seconds left), `weapon` (index into WEAPONS)
- `diff` (difficulty: `{id, name, hp, count, speed, coins, dmg}`), `vehicles` (array owned by powerups.js)
- `stats` (also `G.stats`): derived tech-tree stats (see tech.js `getStats()`)

Functions:
- `G.track(obj3d)` / `G.untrack(obj3d)` — add/remove an Object3D to the scene; tracked objects are removed automatically at run end.
- `G.totalMen()`; `G.addAllies(n, {x, z}?)`; `G.hurtSquad(n, {x, z, radius}?)` → kills up to n soldiers (nearest to x,z within radius if given), respects the `shield` buff, returns number killed.
- `G.damageEnemy(e, dmg)`; `G.areaDamage(x, z, r, dmg, {color, bossMult=1, noFx})` (hits enemies, barrels, boss)
- `G.damageBoss(dmg, mult=1)`
- `G.spawnBullet(x, z, vx, vz, dmg, {color, size, y, life, pierce, splash})` — friendly projectile
- `G.spawnEnemy(type, x, z, hpMult=1)` — type: `grunt|runner|armored|giant`
- `G.enemyHp(wave)` — base enemy HP for a wave (difficulty already applied)
- `G.perSoldierDmg()` — current damage of one soldier shot; `G.squadDps()` — rough squad DPS
- `G.getTargets()` — live enemy targets ahead of the squad, nearest first (boss included first when in range)
- FX: `G.explosion(x,y,z,r,color)`, `G.burst(x,y,z,color,count,speed)`, `G.floater(x,y,z,text,cssColor,px)`,
  `G.banner(text, sub, isBoss)`, `G.shake(amount 0..2)`, `G.sfx(name)` (names in audio.js), `G.earn(coins)`
- `G.setWeapon(index)` — switch squad weapon; `G.rand(a,b)`

## bosses.js
- `createBoss(G, wave)` → boss object. Called on every wave where `wave % 5 === 0` (waves 5..200+).
  Required fields: `name`, `title` (subtitle), `x`, `z`, `hp`, `maxHp`, `radius` (xz hit radius), `height`,
  `holdWorld` (set true once in the arena: main stops scrolling), `armor` (0..1 damage reduction, optional),
  `invulnerable` (optional bool). Methods: `update(G, dt)`, `destroy(G)` (remove meshes). Main handles the
  HP bar, bullet collisions against (x, z, radius), death rewards and the death explosion.
- Boss attacks hurt the squad via `G.hurtSquad`, summon via `G.spawnEnemy`, and must honour `G.S.buffs.freeze`.

## powerups.js
- `BUFFS` export: `{ key: {icon, name, color} }` for the HUD. Main honours: `rage` (fire rate x2), `power`
  (damage x2), `shield` (soldiers can't die), `freeze` (enemies/boss frozen), `coins` (coins x2), `giant` (bigger squad, dmg x1.5).
- `initRun(G)`, `clear(G)`, `update(G, dt)`
- `spawnPickup(G, x)` — a pickup at (x, G.SPAWN_Z)
- `spawnRecruits(G, x, count)` — neutral soldiers waiting to be rescued at (x, G.SPAWN_Z)
- `barrelReward(G)` → `{icon, text, color, weaponIndex?, apply(G, x, z)}` (the loot shown above a barrel)
- `absorbHit(G, enemy)` → true if a friendly vehicle took the hit instead of a soldier
