// Boss roster. STUB — being implemented. See API.md for the contract.
export function createBoss(G, wave) {
  const THREE = G.THREE;
  const g = G.models.buildTank(0xc23b3b, 1);
  G.track(g);
  const hp = G.enemyHp(wave) * (40 + wave * 1.6);
  return {
    name: 'IRON BEHEMOTH', title: `WAVE ${wave} BOSS`, x: 0, z: G.SPAWN_Z - 6, hp, maxHp: hp, radius: 2.6, height: 3.5, holdWorld: false, armor: 0,
    update(G, dt) {
      const frozen = G.S.buffs.freeze > 0;
      if (!frozen) {
        if (this.z < -34) this.z += (G.S.speed + 3) * dt;
        else { this.holdWorld = true; if (this.z < -14) this.z += 2 * dt; }
      }
      g.position.set(this.x, 0, this.z);
    },
    destroy(G) { G.untrack(g); },
  };
}
