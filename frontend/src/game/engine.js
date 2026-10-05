// Real-time side-view combat engine + neon canvas renderer.
// Logical portrait resolution; enemies advance TOP -> DOWN to heroes at BOTTOM.
// Simulation is separate from React; mutates a cloned `sim` fragment and
// accumulates XP gains, returned to the UI at wave end.
import * as C from "./config";
import { heroDerived, towerDerived, makeSingleEnemy } from "./logic";

export const W = 420, H = 760;
const WALL_Y = 0.30 * H;   // yellow outer boundary
const GATE_Y = 0.60 * H;   // hot-red inner gate line
const HERO_Y = 0.85 * H;   // heroes line
const CASTLE_Y = H - 6;    // keep

const LANES = 5;
function laneX(i) { return (W / LANES) * (i + 0.5); }

// tower slot positions (mid-field, alternating sides)
const SLOT_POS = [
  { x: 60, y: WALL_Y - 46 },
  { x: W - 60, y: WALL_Y - 46 },
  { x: 60, y: (WALL_Y + GATE_Y) / 2 },
  { x: W - 60, y: (WALL_Y + GATE_Y) / 2 },
  { x: W / 2, y: WALL_Y + 24 },
];

export function slotPositions() { return SLOT_POS; }
export const LAYOUT = { W, H, WALL_Y, GATE_Y, HERO_Y, CASTLE_Y };

export class Engine {
  constructor(canvas, sim, wave, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.sim = sim;              // cloned fragment (mutated)
    this.wave = wave;           // {enemies,total,...}
    this.cb = callbacks;
    this.speed = 1;
    this.running = false;
    this.last = 0;
    this.spawnQueue = [...wave.enemies];
    this.spawnTimer = 0;
    this.active = [];           // live enemies
    this.projectiles = [];
    this.floaters = [];
    this.effects = [];
    this.killed = 0;
    this.xpGains = { heroes: {}, towers: {} };
    this.time = 0;
    this.ended = false;

    // hero runtime
    const n = sim.heroes.length || 1;
    this.heroes = sim.heroes.map((h, i) => {
      const d = heroDerived(h);
      const x = W * ((i + 0.5) / n);
      return {
        i,
        ref: h,
        x,
        y: HERO_Y,
        home: { x, y: HERO_Y },
        d,
        cd: 0,
        alive: h.hp > 0,
        protect: 0,
        manual: !!h.manual,
        manualTarget: null,
        manualPoint: null,
        rallyPoint: null,
        rallyHold: false,
        retreating: false,
      };
    });

    // tower runtime (free placement: use each tower's own x,y)
    this.towers = sim.towers.map((t, idx) => {
      const d = towerDerived(t);
      return { slot: idx, ref: t, x: t.x, y: t.y, d, cd: 0 };
    });

    this.barricades = sim.barricades.map((b, lane) => ({ lane, ref: b, x: laneX(lane), y: WALL_Y }));
  }

  start() {
    this.running = true;
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }
  stop() { this.running = false; }
  setSpeed(s) { this.speed = s; }

  setHeroManual(index, manual) {
    const h = this.heroes[index];
    if (!h) return false;
    h.manual = !!manual;
    h.ref.manual = !!manual;
    if (!h.manual) {
      h.manualTarget = null;
      h.manualPoint = null;
    }
    h.rallyPoint = null;
    h.rallyHold = false;
    h.retreating = false;
    return true;
  }

  commandHeroAttack(index, target) {
    const h = this.heroes[index];
    if (!h || !h.alive || !target || target.hp <= 0) return false;
    h.manual = true;
    h.ref.manual = true;
    h.manualTarget = target;
    h.manualPoint = null;
    h.rallyPoint = null;
    h.rallyHold = false;
    return true;
  }

  retreatHero(index) {
    const h = this.heroes[index];
    if (!h || !h.alive) return false;
    h.manual = true;
    h.ref.manual = true;
    h.manualTarget = null;
    h.manualPoint = null;
    h.rallyPoint = null;
    h.rallyHold = false;
    h.retreating = true;
    return true;
  }

  rallyHeroes(index) {
    const leader = this.heroes[index];
    if (!leader || !leader.alive) return false;

    // The hero issuing RALLY is the rally anchor. Everyone else moves to
    // that hero's current position; the caller itself must NOT fall back
    // to its original home position after issuing the command.
    const point = { x: leader.x, y: leader.y };

    for (const h of this.heroes) {
      if (!h.alive) continue;
      h.retreating = false;
      h.manualTarget = null;
      h.manualPoint = null;
      h.rallyHold = h === leader;
      h.rallyPoint = h === leader ? null : { ...point };
    }

    return true;
  }

  reviveHero(index) {
    const h = this.heroes[index];
    if (!h || h.alive || h.ref.hp > 0) return false;
    const cost = C.paidRevivalCost(h.ref.level);
    if (this.sim.gold < cost) return false;

    this.sim.gold -= cost;
    h.ref.hp = h.d.maxHp;
    h.alive = true;
    h.protect = C.REVIVE_PROTECT_S;
    h.manual = false;
    h.ref.manual = false;
    h.manualTarget = null;
    h.manualPoint = null;
    h.rallyPoint = null;
    h.retreating = false;
    h.x = h.home.x;
    h.y = h.home.y;
    return true;
  }

  commandHeroMoveTo(index, x, y) {
    const h = this.heroes[index];
    if (!h || !h.alive) return false;

    h.manual = true;
    h.ref.manual = true;
    h.manualTarget = null;
    h.manualPoint = {
      x: Math.max(12, Math.min(W - 12, x)),
      y: Math.max(12, Math.min(CASTLE_Y - 12, y)),
    };
    h.rallyPoint = null;
    h.rallyHold = false;
    h.retreating = false;
    return true;
  }

  commandHeroAttackAt(index, x, y) {
    const target = this.active.reduce((best, e) => {
      if (e.hp <= 0) return best;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > 55) return best;
      if (!best) return e;
      return d < Math.hypot(best.x - x, best.y - y) ? e : best;
    }, null);

    // Manual battlefield taps have two meanings:
    // - tap an enemy -> attack that exact enemy
    // - tap open ground -> move to that exact battlefield position
    return target
      ? this.commandHeroAttack(index, target)
      : this.commandHeroMoveTo(index, x, y);
  }

  injectEnemy(e) {
    e.x = laneX(pickLane(this, e)); e.y = 12;
    e.lane = Math.round(e.x / (W / LANES) - 0.5);
    e.dmgBy = {}; e.atkCd = 0; e.state = "advance";
    this.active.push(e);
    this.wave.total += 1;
  }
  forceDefeat() { this.sim.castleHp = 0; }
  forceWin() { this.spawnQueue = []; this.active = []; }

  _loop(now) {
    if (!this.running) return;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    this.update(dt * this.speed);
    this.render();
    if (!this.ended) requestAnimationFrame(this._loop);
  }

  update(dt) {
    this.time += dt;

    // spawn: release enemies gradually (group release proxy)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.spawnQueue.length) {
      const capInZone = this.wave.total * 0.65;
      if (this.active.length < capInZone) {
        const e = this.spawnQueue.shift();
        e.x = laneX(pickLane(this, e)); e.y = 10 + Math.random() * 20;
        e.lane = Math.round(e.x / (W / LANES) - 0.5);
        e.dmgBy = {}; e.atkCd = 0; e.state = "advance";
        this.active.push(e);
      }
      this.spawnTimer = this.wave.hasBoss && this.spawnQueue.length === 0 ? 0 : 0.55;
    }

    // enemies
    for (const e of this.active) this._updateEnemy(e, dt);
    this.active = this.active.filter((e) => e.hp > 0);

    // towers fire
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      t.cd -= dt;
      if (t.cd <= 0) {
        const target = this._nearestEnemy(t.x, t.y, t.d.range);
        if (target) { this._fire("T" + t.slot, t, target, t.d); t.cd = 1 / t.d.fireRate; }
      }
      if (t.ref.underfunded) t.ref.hp = Math.max(0, t.ref.hp - t.d.maxHp * C.UNDERFUNDED.hpLossPerMin * dt / 60);
    }

    // heroes: outer defenses are attrition; the Castle Squad ENGAGES once the
    // enemy breaches the gate line. Melee heroes advance to attack; ranged fire in place.
    const breached = this.active.some((e) => e.y > GATE_Y);
    for (const h of this.heroes) {
      if (!h.alive) continue;
      if (h.protect > 0) { h.protect -= dt; continue; }
      h.cd -= dt;
      const cfg = h.ref.attackConfig || "";
      const melee = h.d.range < 130;
      const support = h.d.magic && /Support|Heal|Barrier/i.test(cfg);

      if (h.retreating) {
        this._returnHome(h, dt);
        if (Math.hypot(h.x - h.home.x, h.y - h.home.y) < 8) h.retreating = false;
        continue;
      }

      if (h.rallyPoint) {
        const rd = Math.hypot(h.rallyPoint.x - h.x, h.rallyPoint.y - h.y);
        if (rd > 24) {
          const spd = 185 * dt;
          h.x += ((h.rallyPoint.x - h.x) / rd) * Math.min(spd, rd);
          h.y += ((h.rallyPoint.y - h.y) / rd) * Math.min(spd, rd);
          continue;
        }
        h.rallyPoint = null;
      }

      // Manual ground command: move to the exact tapped position and then
      // hold there. This persists until another manual command or RETREAT.
      if (h.manualPoint) {
        const md = Math.hypot(h.manualPoint.x - h.x, h.manualPoint.y - h.y);
        if (md > 8) {
          const spd = 155 * dt;
          h.x += ((h.manualPoint.x - h.x) / md) * Math.min(spd, md);
          h.y += ((h.manualPoint.y - h.y) / md) * Math.min(spd, md);
          continue;
        }
        h.x = h.manualPoint.x;
        h.y = h.manualPoint.y;
        h.manualPoint = null;
        continue;
      }

      // A rally caller is the anchor of the regroup. Keep that hero at the
      // rally location instead of sending it back to its starting position.
      if (h.rallyHold && !h.manualTarget) {
        const nearbyRallyTarget = this._nearestEnemy(h.x, h.y, 220);
        if (nearbyRallyTarget) {
          h.manualTarget = nearbyRallyTarget;
        } else {
          continue;
        }
      }
      // Mage support/barrier config: mend or shield allies (works pre-breach too)
      if (support) {
        if (h.cd <= 0 && this._support(h, cfg)) h.cd = h.d.rate;
        this._returnHome(h, dt);
        continue;
      }
      const nearbyAutoTarget = this._nearestEnemy(h.x, h.y, 220);
      if (!breached && !h.manual && !nearbyAutoTarget) { this._returnHome(h, dt); continue; }
      let target = h.manual ? h.manualTarget : this._selectTarget(h);

      if (target && target.hp <= 0) {
        h.manualTarget = null;
        target = h.manual ? null : this._selectTarget(h);
      }

      // Manual heroes hold their current position when they have no target.
      // They return home only through the explicit RETREAT command.
      if (h.manual && !target) {
        continue;
      }

      if (melee) {
        if (target) {
          const dist = Math.hypot(target.x - h.x, target.y - h.y) || 1;
          if (dist > h.d.range - 6) {
            const spd = 155 * dt;
            h.x += ((target.x - h.x) / dist) * Math.min(spd, dist);
            h.y += ((target.y - h.y) / dist) * Math.min(spd, dist);
          } else if (h.cd <= 0) {
            this._fire("H" + h.i, h, target, h.d, true);
            h.cd = h.d.rate;
          }
        } else if (!h.manual) this._returnHome(h, dt);
      } else if (h.cd <= 0 && target) {
        this._fire("H" + h.i, h, target, h.d, true);
        h.cd = h.d.rate;
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      p.t += dt;
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.spd * dt;
      if (dist <= step || !p.target || p.target.hp <= 0) {
        if (p.kind === "napalm") {
          this._explodeNapalm(p.x, p.y, p);
        } else if (p.target && p.target.hp > 0) {
          this._applyHit(p);
        }
        p.dead = true;
      } else { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    // floaters
    for (const f of this.floaters) { f.y -= 20 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const fx of this.effects) fx.life -= dt;
    this.effects = this.effects.filter((f) => f.life > 0);

    this._hud();
    this._checkEnd();
  }

  _updateEnemy(e, dt) {
    e.atkCd -= dt;
    // Boss special: a targeted, proximity-based napalm bottle.
    // It no longer damages every hero simultaneously. The target is the nearest
    // living hero or tower inside the boss's configured attack range.
    if (e.boss) {
      e.abilityCd = (e.abilityCd == null ? 5 : e.abilityCd) - dt;
      if (e.abilityCd <= 0) {
        const range = e.attackRange || 420;
        const target = this._nearestDefender(e.x, e.y, range);
        if (target) {
          e.abilityCd = 6;
          for (let k = 0; k < 2; k++) this.injectEnemy(makeSingleEnemy(this.sim, "skeleton"));
          this._throwNapalm(e, target);
        } else {
          e.abilityCd = 1;
        }
      }
    }
    // barricade in lane?
    const bar = this.barricades[e.lane];
    if (!e.floats && bar && bar.ref.hp > 0 && Math.abs(e.y - WALL_Y) < 16 && e.y < WALL_Y + 4) {
      // attack barricade
      if (e.atkCd <= 0) {
        bar.ref.hp = Math.max(0, bar.ref.hp - e.damage);
        e.hp = Math.max(0, e.hp - C.BARRICADE.collisionDamage); // collision dmg
        e.atkCd = 0.8;
        if (e.hp <= 0) { this._killEnemy(e, null); return; }
      }
      return;
    }
    // objective-based targeting near their position
    let blocker = null;
    if (e.objective === "towers") blocker = this._nearestTower(e.x, e.y, 46);
    if (!blocker) blocker = this._nearestHeroEntity(e.x, e.y, 30);
    if (blocker) {
      if (e.atkCd <= 0) {
        this._enemyAttack(e, blocker);
        e.atkCd = 1.0;
      }
      return;
    }
    // advance downward
    e.y += e.speed * dt;
    if (e.y >= CASTLE_Y) {
      // reached castle -> damage it
      this._damageCastle(e.damage * 4);
      this._killEnemy(e, null, true);
    }
  }

  _nearestDefender(x, y, range) {
    let best = null;
    let bd = range;
    for (const h of this.heroes) {
      if (!h.alive) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= bd) {
        bd = d;
        best = { kind: "hero", obj: h };
      }
    }
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= bd) {
        bd = d;
        best = { kind: "tower", obj: t };
      }
    }
    return best;
  }

  _throwNapalm(e, target) {
    const obj = target.obj;
    const d = obj.kind === "tower" ? obj.y : obj.y;
    this.projectiles.push({
      kind: "napalm",
      sourceId: "E" + e.type,
      x: e.x,
      y: e.y,
      tx: obj.x,
      ty: d,
      target: obj,
      targetKind: target.kind,
      spd: 250,
      dmg: e.damage * 1.3,
      splash: e.splashRadius || 68,
      color: "#FF6600",
      t: 0,
    });
    // Short launch/charge flash at the boss.
    this.effects.push({ kind: "charge", x: e.x, y: e.y, r: 28, life: 0.45, color: "#FF6600" });
  }

  _explodeNapalm(x, y, p) {
    const splash = p.splash || 68;
    const victims = [];

    for (const h of this.heroes) {
      if (!h.alive) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= splash) victims.push({ kind: "hero", obj: h, dist: d });
    }
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= splash) victims.push({ kind: "tower", obj: t, dist: d });
    }

    // A bottle is a local area attack: only defenders standing in the
    // impact radius are hit. Spacing the squad therefore matters.
    for (const v of victims) {
      const falloff = 1 - 0.45 * (v.dist / splash);
      let dmg = p.dmg * falloff;
      if (v.kind === "hero") {
        const h = v.obj;
        if (Math.random() < h.d.dodge) {
          this._float(h.x, h.y - 20, "DODGE", "#00F3FF");
          continue;
        }
        dmg = C.damageAfterDefense(dmg, h.ref.stats.defense);
        if (h.ref.shield > 0) {
          const ab = Math.min(h.ref.shield, dmg);
          h.ref.shield -= ab;
          dmg -= ab;
        }
        h.ref.hp = Math.max(0, h.ref.hp - dmg);
        this._float(h.x, h.y - 20, "-" + Math.round(dmg), "#FF6600");
        if (h.ref.hp <= 0 && h.alive) {
          h.alive = false;
          this.sim.morale = clamp(this.sim.morale + C.MORALE.heroDefeat);
        }
      } else {
        const t = v.obj;
        t.ref.hp = Math.max(0, t.ref.hp - dmg);
        if (t.ref.hp <= 0) {
          this.sim.morale = clamp(this.sim.morale + C.MORALE.towerDestroyed);
          this.effects.push({ x: t.x, y: t.y, r: 30, life: 0.4, color: t.d.color });
        }
        this._float(t.x, t.y - 20, "-" + Math.round(dmg), "#FF6600");
      }

      // Persistent short fire-over-time visual on the actual victim.
      this.effects.push({
        kind: "fire",
        x: v.obj.x,
        y: v.obj.y,
        life: 1.0,
        color: "#FF6600",
        target: v.obj,
        targetKind: v.kind,
      });
    }

    // Bottle shatters where it lands: flash + expanding fire ring.
    this.effects.push({ kind: "napalm", x, y, r: 16, life: 0.9, color: "#FF6600" });
    this.effects.push({ kind: "impact", x, y, r: 10, life: 0.35, color: "#FFE600" });
  }

  _enemyAttack(e, blocker) {
    if (blocker.kind === "tower") {
      const t = blocker.obj;
      t.ref.hp = Math.max(0, t.ref.hp - e.damage);
      if (t.ref.hp <= 0) {
        this.sim.morale = clamp(this.sim.morale + C.MORALE.towerDestroyed);
        this.effects.push({ x: t.x, y: t.y, r: 30, life: 0.4, color: t.d.color });
      }
    } else {
      const h = blocker.obj;
      if (Math.random() < h.d.dodge) { this._float(h.x, h.y - 20, "DODGE", "#00F3FF"); return; }
      let dmg = C.damageAfterDefense(e.damage, h.ref.stats.defense);
      if (h.ref.shield > 0) { const ab = Math.min(h.ref.shield, dmg); h.ref.shield -= ab; dmg -= ab; }
      h.ref.hp = Math.max(0, h.ref.hp - dmg);
      if (e.boss) e.hp = Math.min(e.maxHp, e.hp + dmg * 0.5); // Demon Lord lifesteal
      this._float(h.x, h.y - 20, "-" + Math.round(dmg), "#FF3366");
      if (h.ref.hp <= 0 && h.alive) {
        h.alive = false;
        this.sim.morale = clamp(this.sim.morale + C.MORALE.heroDefeat);
      }
    }
  }

  _fire(sourceId, src, target, d, isHero) {
    this.projectiles.push({
      sourceId, x: src.x, y: src.y, tx: target.x, ty: target.y, target,
      spd: d.magic ? 340 : 460, dmg: d.damage || d.attack, magic: !!d.magic,
      color: isHero ? d.color : d.color, t: 0,
    });
    this.effects.push({ x: src.x, y: src.y, r: 8, life: 0.18, color: d.color, ring: true });
  }

  _applyHit(p) {
    const e = p.target;
    if (p.magic && e.magicImmune) { this._float(e.x, e.y, "IMMUNE", "#39FF14"); return; }
    let dmg = p.dmg;
    const crit = Math.random() < C.BASE_CRIT;
    if (crit) dmg *= C.CRIT_MULT;
    e.hp = Math.max(0, e.hp - dmg);
    e.dmgBy[p.sourceId] = (e.dmgBy[p.sourceId] || 0) + dmg;
    this._float(e.x, e.y, (crit ? "!" : "") + Math.round(dmg), crit ? "#FFE600" : "#FFFFFF");
    if (e.hp <= 0) this._killEnemy(e, p.sourceId);
  }

  _killEnemy(e, sourceId, silent) {
    if (e._dead) return;
    e._dead = true; e.hp = 0;
    this.killed += 1;
    this.sim.kills.total += 1;
    this.sim.kills.byType[e.type] = (this.sim.kills.byType[e.type] || 0) + 1;

    // reward gold continuously
    const tier = C.ENEMY_TIERS[e.tier] || C.ENEMY_TIERS.basic;
    this.sim.gold += tier.gold;

    // XP attribution
    if (e.boss) {
      const totalDmg = Object.values(e.dmgBy).reduce((a, b) => a + b, 0) || 1;
      for (const sid in e.dmgBy) {
        const share = (e.dmgBy[sid] / totalDmg) * tier.xp;
        this._awardXp(sid, share);
      }
      this.sim.morale = clamp(this.sim.morale + C.MORALE.bossKill);
    } else {
      let best = null, bestDmg = -1;
      for (const sid in e.dmgBy) if (e.dmgBy[sid] > bestDmg) { bestDmg = e.dmgBy[sid]; best = sid; }
      if (best) this._awardXp(best, tier.xp);
      const m = e.tier === "elite" ? C.MORALE.eliteKill : e.tier === "specialized" ? C.MORALE.specialistKill : C.MORALE.heroKill;
      if (best && best[0] === "H") this.sim.morale = clamp(this.sim.morale + m);
    }
    if (!silent) this.effects.push({ x: e.x, y: e.y, r: e.boss ? 60 : 20, life: 0.4, color: e.color });
    if (this.cb.onKill) this.cb.onKill();
  }

  _awardXp(sid, xp) {
    if (sid[0] === "H") {
      const i = +sid.slice(1);
      this.xpGains.heroes[i] = (this.xpGains.heroes[i] || 0) + xp;
    } else if (sid[0] === "T") {
      const slot = +sid.slice(1);
      this.xpGains.towers[slot] = (this.xpGains.towers[slot] || 0) + xp;
    }
  }

  _damageCastle(dmg) {
    const before = this.sim.castleHp;
    this.sim.castleHp = Math.max(0, this.sim.castleHp - dmg);
    const pctLost = (before - this.sim.castleHp) / this.sim.castleMaxHp * 100;
    this.sim.morale = clamp(this.sim.morale + Math.round(C.MORALE.castleLossPerPct * pctLost));
    this.effects.push({ x: W / 2, y: CASTLE_Y - 10, r: 40, life: 0.3, color: "#FF0055" });
  }

  _nearestEnemy(x, y, range) {
    let best = null, bd = range;
    for (const e of this.active) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d <= bd) { bd = d; best = e; }
    }
    return best;
  }
  // targeting tactics driven by the hero's attack configuration
  _selectTarget(h) {
    const cfg = h.ref.attackConfig || "";
    const melee = h.d.range < 130;
    const pool = melee
      ? this.active.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) <= 220)
      : this.active.filter((e) => Math.hypot(e.x - h.x, e.y - h.y) <= h.d.range);
    if (!pool.length) return null;
    const pick = (fn, dir) => pool.reduce((a, b) => (fn(b) * dir > fn(a) * dir ? b : a));
    if (/Weakest|Assassinate/i.test(cfg)) return pick((e) => e.hp, -1);       // lowest HP
    if (/Sniper|strongest/i.test(cfg)) return pick((e) => e.maxHp, 1);        // toughest
    if (/Guard|Defensive/i.test(cfg)) return pick((e) => e.y, 1);            // closest to keep
    return pick((e) => Math.hypot(e.x - h.x, e.y - h.y), -1);                // nearest (default)
  }
  _support(h, cfg) {
    const barrier = /Barrier/i.test(cfg);
    let ally = null, worst = Infinity;
    for (const a of this.heroes) {
      if (!a.alive) continue;
      const frac = a.ref.hp / a.d.maxHp;
      if (frac < worst) { worst = frac; ally = a; }
    }
    if (!ally) return false;
    if (barrier) {
      const cap = ally.d.maxHp * 0.25;
      ally.ref.shield = Math.min(cap, (ally.ref.shield || 0) + 28 * h.d.healPower);
      this._float(ally.x, ally.y - 22, "+SHIELD", "#00F3FF");
      this.effects.push({ x: ally.x, y: ally.y, r: 24, life: 0.4, color: "#00F3FF" });
    } else {
      if (ally.ref.hp >= ally.d.maxHp) return false;
      const heal = 34 * h.d.healPower;
      ally.ref.hp = Math.min(ally.d.maxHp, ally.ref.hp + heal);
      this._float(ally.x, ally.y - 22, "+" + Math.round(heal), "#39FF14");
      this.effects.push({ x: ally.x, y: ally.y, r: 22, life: 0.4, color: "#39FF14" });
    }
    return true;
  }
  _nearestTower(x, y, r) {
    for (const t of this.towers) if (t.ref.hp > 0 && Math.hypot(t.x - x, t.y - y) <= r) return { kind: "tower", obj: t };
    return null;
  }
  _nearestHeroEntity(x, y, r) {
    let best = null, bd = r;
    for (const h of this.heroes) if (h.alive) { const d = Math.hypot(h.x - x, h.y - y); if (d <= bd) { bd = d; best = h; } }
    return best ? { kind: "hero", obj: best } : null;
  }
  _returnHome(h, dt) {
    const dx = h.home.x - h.x, dy = h.home.y - h.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) return;
    const spd = 150 * dt;
    h.x += (dx / d) * Math.min(spd, d);
    h.y += (dy / d) * Math.min(spd, d);
  }

  _float(x, y, text, color) { this.floaters.push({ x, y, text, color, life: 0.7 }); }

  _hud() {
    if (!this.cb.onHud) return;
    this.cb.onHud({
      total: this.wave.total, killed: this.killed,
      remaining: this.active.length + this.spawnQueue.length,
      castleHp: this.sim.castleHp, castleMaxHp: this.sim.castleMaxHp,
      morale: this.sim.morale, gold: this.sim.gold, food: this.sim.food, stone: this.sim.stone,
      heroes: this.heroes.map((h) => ({ name: h.ref.name, hp: h.ref.hp, maxHp: h.d.maxHp, alive: h.alive, shield: h.ref.shield || 0 })),
      boss: (() => { const b = this.active.find((e) => e.boss); return b ? { name: b.name, hp: b.hp, maxHp: b.maxHp } : null; })(),
    });
  }

  _checkEnd() {
    if (this.ended) return;
    if (this.sim.castleHp <= 0) { this.ended = true; this.stop(); this.cb.onEnd && this.cb.onEnd({ victory: false, xpGains: this.xpGains, killed: this.killed }); return; }
    const anyHero = this.heroes.some((h) => h.alive);
    const allDead = !anyHero && this.towers.every((t) => t.ref.hp <= 0);
    if (this.spawnQueue.length === 0 && this.active.length === 0) {
      this.ended = true; this.stop();
      this.cb.onEnd && this.cb.onEnd({ victory: true, xpGains: this.xpGains, killed: this.killed });
    } else if (allDead && this.active.length > 0) {
      // no defenders left but enemies keep coming -> they will erode castle; keep running
    }
  }

  // ---------------- rendering ----------------
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    // field
    ctx.fillStyle = "#12131A"; ctx.fillRect(0, 0, W, H);
    // subtle grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
    for (let gx = 0; gx <= W; gx += 42) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy <= H; gy += 42) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    this._neonLine(0, WALL_Y, W, WALL_Y, "#FFE600", 3);
    this._neonLine(0, GATE_Y, W, GATE_Y, "#FF2A5F", 3);

    // castle keep
    ctx.save();
    ctx.shadowBlur = 18; ctx.shadowColor = "#FF2A5F";
    ctx.strokeStyle = "#FF2A5F"; ctx.lineWidth = 2;
    ctx.strokeRect(W / 2 - 70, CASTLE_Y - 26, 140, 26);
    ctx.restore();

    // barricades
    this.barricades.forEach((b) => {
      if (b.ref.maxHp <= 0) return;
      const w = (W / LANES) * 0.8, x = b.x - w / 2;
      const frac = b.ref.hp / b.ref.maxHp;
      this._hazardBar(x, WALL_Y - 7, w, 14, frac);
    });

    // towers (placed freely on the field)
    for (const t of this.towers) {
      this._bracketSquare(t.x, t.y, 30, t.d.color);
      if (t.ref.hp > 0) {
        this._glowShape(t.x, t.y, 10, t.d.color, t.ref.underfunded ? 0.4 : 1);
        this._bar(t.x - 15, t.y + 14, 30, 3, t.ref.hp / t.d.maxHp, t.d.color);
      }
    }

    // enemies
    for (const e of this.active) {
      const r = e.boss ? 22 : e.tier === "elite" ? 14 : 9;
      this._glowShape(e.x, e.y, r, e.color, 1, e.floats);
      if (e.boss) { // three-headed motif
        this._glowShape(e.x - 12, e.y - 6, 8, e.color, 1);
        this._glowShape(e.x + 12, e.y - 6, 8, e.color, 1);
      }
      this._bar(e.x - r, e.y - r - 5, r * 2, 3, e.hp / e.maxHp, e.color);
      if (this.heroes.some((h) => h.manual && h.manualTarget === e)) {
        ctx.save();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 7, 0, 7);
        ctx.stroke();
        ctx.restore();
      }
    }

    // heroes
    for (const h of this.heroes) {
      ctx.save();
      ctx.shadowBlur = 16; ctx.shadowColor = h.d.color;
      ctx.globalAlpha = h.alive ? (h.protect > 0 ? 0.5 : 1) : 0.2;
      ctx.fillStyle = h.d.color;
      roundRect(ctx, h.x - 11, h.y - 15, 22, 30, 6); ctx.fill();
      ctx.restore();
      this._bar(h.x - 14, h.y + 18, 28, 4, Math.max(0, h.ref.hp) / h.d.maxHp, h.d.color);
    }

    // projectiles
    for (const p of this.projectiles) {
      ctx.save();
      if (p.kind === "napalm") {
        ctx.shadowBlur = 18; ctx.shadowColor = "#FF6600";
        ctx.fillStyle = "#FF6600";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#FFE600";
        ctx.beginPath();
        ctx.arc(p.x - 2, p.y - 2, 2.5, 0, 7);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,102,0,0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x - 12, p.y + 5);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.magic ? 4 : 3, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
    // effects
    for (const fx of this.effects) {
      const alpha = Math.max(0, Math.min(1, fx.life * 2.2));
      ctx.save();

      if (fx.kind === "fire") {
        const pulse = 1 + 0.12 * Math.sin(this.time * 24 + fx.x);
        const base = 13 * pulse;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 22; ctx.shadowColor = "#FF6600";
        ctx.fillStyle = "#FF6600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, base, 0, 7); ctx.fill();
        ctx.fillStyle = "#FFE600";
        ctx.beginPath(); ctx.arc(fx.x - 2, fx.y - 4, base * 0.55, 0, 7); ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(fx.x - 3, fx.y - 6, base * 0.2, 0, 7); ctx.fill();
        // small rising flame tongues
        for (let i = 0; i < 3; i++) {
          const ox = (i - 1) * 7;
          const rise = 7 + ((this.time * 22 + i * 9) % 12);
          ctx.globalAlpha = alpha * 0.8;
          ctx.fillStyle = i === 1 ? "#FFE600" : "#FF6600";
          ctx.beginPath();
          ctx.arc(fx.x + ox, fx.y - rise, 4 - i * 0.5, 0, 7);
          ctx.fill();
        }
      } else if (fx.kind === "napalm") {
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 28; ctx.shadowColor = "#FF6600";
        ctx.strokeStyle = "#FF6600"; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r + (1 - fx.life) * 54, 0, 7); ctx.stroke();
        ctx.fillStyle = "#FF6600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 10 + (1 - fx.life) * 18, 0, 7); ctx.fill();
        ctx.fillStyle = "#FFE600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 + (1 - fx.life) * 9, 0, 7); ctx.fill();
      } else if (fx.kind === "charge") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#FF6600"; ctx.lineWidth = 3;
        ctx.shadowBlur = 20; ctx.shadowColor = "#FF6600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r + (1 - fx.life) * 18, 0, 7); ctx.stroke();
        ctx.strokeStyle = "#FFE600";
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + (1 - fx.life) * 10, 0, 7); ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = fx.color;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1 - fx.life), 0, 7); ctx.stroke();
      }
      ctx.restore();
    }
    // floaters
    ctx.textAlign = "center"; ctx.font = "bold 11px JetBrains Mono, monospace";
    for (const f of this.floaters) {
      ctx.save(); ctx.globalAlpha = Math.max(0, f.life * 1.4);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); ctx.restore();
    }
  }

  _neonLine(x1, y1, x2, y2, color, w) {
    const ctx = this.ctx;
    ctx.save(); ctx.shadowBlur = 14; ctx.shadowColor = color;
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  _glowShape(x, y, r, color, alpha = 1, diamond) {
    const ctx = this.ctx;
    ctx.save(); ctx.globalAlpha = alpha; ctx.shadowBlur = 14; ctx.shadowColor = color;
    ctx.fillStyle = color; ctx.beginPath();
    if (diamond) { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    else ctx.arc(x, y, r, 0, 7);
    ctx.fill(); ctx.restore();
  }
  _bar(x, y, w, h, frac, color) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }
  _bracketSquare(cx, cy, s, color) {
    const ctx = this.ctx; const h = s / 2, len = 9;
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowBlur = 6; ctx.shadowColor = color;
    const corners = [[-h, -h, 1, 1], [h, -h, -1, 1], [-h, h, 1, -1], [h, h, -1, -1]];
    for (const [dx, dy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + dx, cy + dy); ctx.lineTo(cx + dx + sx * len, cy + dy);
      ctx.moveTo(cx + dx, cy + dy); ctx.lineTo(cx + dx, cy + dy + sy * len);
      ctx.stroke();
    }
    ctx.restore();
  }
  _hazardBar(x, y, w, h, frac) {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = "#12131A"; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#FFE600";
    for (let i = -h; i < w; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.lineTo(x + i + h + 6, y); ctx.lineTo(x + i + 6, y + h); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.save(); ctx.strokeStyle = `rgba(255,230,0,${0.4 + 0.6 * frac})`; ctx.lineWidth = 2; ctx.shadowBlur = 8; ctx.shadowColor = "#FFE600";
    ctx.strokeRect(x, y, w, h); ctx.restore();
  }
}

function pickLane(engine, e) {
  // path of least resistance: lowest (barricade hp + tower threat) lane, floats ignore barricades
  let best = 0, bestCost = Infinity;
  for (let l = 0; l < LANES; l++) {
    const bar = engine.barricades[l];
    let cost = e.floats ? 0 : (bar ? bar.ref.hp : 0);
    for (const t of engine.towers) if (t.ref.hp > 0 && Math.abs(t.x - laneX(l)) < 90) cost += t.d.damage * 3;
    cost += Math.random() * 40;
    if (cost < bestCost) { bestCost = cost; best = l; }
  }
  return best;
}
function clamp(v) { return Math.max(0, Math.min(100, v)); }
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
