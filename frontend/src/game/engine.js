// Real-time side-view combat engine + neon canvas renderer.
// Logical portrait resolution; enemies advance TOP -> DOWN to heroes at BOTTOM.
// Simulation is separate from React; mutates a cloned `sim` fragment and
// accumulates XP gains, returned to the UI at wave end.
import * as C from "./config";
import { heroDerived, towerDerived, makeSingleEnemy } from "./logic";
import { rollEquipmentDrop } from "./equipment";

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
    this.castleEscaped = 0;
    this.xpGains = { heroes: {}, towers: {} };
    this.sim.vault = Array.isArray(this.sim.vault) ? this.sim.vault : [];
    this.time = 0;
    this.ended = false;
    this.selectedHero = null;

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
    // State may contain empty/null tower slots. The prep/economy layer
    // intentionally supports sparse tower arrays, so never dereference a
    // missing slot while constructing the battle runtime.
    this.towers = (Array.isArray(sim.towers) ? sim.towers : []).reduce((acc, t, idx) => {
      if (!t || !C.TOWERS[t.type] || !C.TOWER_RESOURCE[t.type]) return acc;
      const d = towerDerived(t);
      const r = C.TOWER_RESOURCE[t.type];
      if (r.kind === "ammo" && t.ammo == null) t.ammo = d.maxAmmo;
      if (r.kind === "ammo" && t.maxAmmo == null) t.maxAmmo = d.maxAmmo;
      if (r.kind === "mana" && t.mana == null) t.mana = d.maxMana;
      if (r.kind === "mana" && t.maxMana == null) t.maxMana = d.maxMana;
      acc.push({ slot: idx, ref: t, x: t.x, y: t.y, d, cd: 0 });
      return acc;
    }, []);

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

  setSelectedHero(index) {
    this.selectedHero = Number.isInteger(index) ? index : null;
    return true;
  }

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
    this.selectedHero = index;
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
    this.selectedHero = index;
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
    this.selectedHero = index;
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
    this.selectedHero = index;
    return true;
  }

  commandHeroAttackAt(index, x, y) {
    const target = this.active.reduce((best, e) => {
      if (e.hp <= 0) return best;
      const d = Math.hypot(e.x - x, e.y - y);
      // Give phone taps a generous target radius without making distant
      // enemies accidentally selectable.
      if (d > 80) return best;
      if (!best) return e;
      return d < Math.hypot(best.x - x, best.y - y) ? e : best;
    }, null);

    // TARGET mode is intentionally target-only. Tapping empty ground does not
    // silently turn into a MOVE command.
    return target ? this.commandHeroAttack(index, target) : false;
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
    try {
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05;
      this.update(dt * this.speed);
      this.render();
      if (!this.ended) requestAnimationFrame(this._loop);
    } catch (err) {
      // Never let one malformed runtime object silently kill the RAF chain.
      // Keep the UI alive and expose the real failure through logcat/console.
      this.running = false;
      console.error("DemonanicEngine LOOP CRASH:", err?.message || err, err?.stack || "");
      if (this.cb.onError) this.cb.onError(err);
    }
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
    // Lieutenant command auras are recalculated every frame so the battlefield
    // visibly behaves like a living formation rather than a stack of stat bags.
    for (const e of this.active) e._commanderBoost = 1;
    for (const e of this.active) {
      if (e.type !== "lieutenant" || e.hp <= 0) continue;
      for (const other of this.active) {
        if (other === e || other.hp <= 0) continue;
        if (Math.hypot(other.x - e.x, other.y - e.y) <= 105) {
          other._commanderBoost = Math.max(other._commanderBoost || 1, 1.15);
        }
      }
    }
    for (const e of this.active) this._updateEnemy(e, dt);
    this.active = this.active.filter((e) => e.hp > 0);

    // towers fire
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      t.cd -= dt;
      if (t.ref.warlockDebuff > 0) t.ref.warlockDebuff = Math.max(0, t.ref.warlockDebuff - dt);
      if (t.cd <= 0) {
        const target = this._selectTowerTarget(t);
        const r = C.TOWER_RESOURCE[t.ref.type];
        const current = r.kind === "ammo" ? (t.ref.ammo || 0) : (t.ref.mana || 0);
        if (target && current >= r.shotCost) {
          if (r.kind === "ammo") t.ref.ammo = current - r.shotCost;
          else t.ref.mana = current - r.shotCost;
          const fireData = t.ref.warlockDebuff > 0 ? { ...t.d, damage: t.d.damage * 0.8 } : t.d;
          this._fire("T" + t.slot, t, target, fireData);
          t.cd = 1 / t.d.fireRate;
        } else if (!target) {
          t.cd = 0.1;
        }
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
    // Enemy archetypes get a small tactical identity on top of their
    // existing stats/objectives. These are intentionally readable rules:
    // fast raiders rush, brutes hunt structures, reapers hunt wounded heroes,
    // and lieutenants reinforce nearby attackers.
    const tactical = this._selectEnemyTacticalTarget(e);
    const commanderBoost = e._commanderBoost || 1;
    if (e.type === "warlock") {
      e.abilityCd = (e.abilityCd == null ? 3 : e.abilityCd) - dt;
      if (e.abilityCd <= 0) {
        // Warlocks are Mage Hunters: Mage first, then any living hero, then
        // tower fallback. This gives the archetype a clear battlefield role
        // and prevents the old tower-wrapper dereference crash.
        const target =
          this._nearestMageEntity(e.x, e.y, 300) ||
          this._nearestHeroEntity(e.x, e.y, 300) ||
          this._nearestTower(e.x, e.y, 300);

        if (target?.kind === "hero") {
          this._enemyAttack(e, target);
          if (target.obj?.ref?.type === "mage") {
            this._float(target.obj.x, target.obj.y - 22, "MAGE HUNT", e.color);
          }
          e.abilityCd = 4.5;
        } else if (target?.kind === "tower") {
          // _nearestTower() returns { kind, obj }; obj.ref is the persisted
          // tower. The previous implementation incorrectly read target.ref.
          const tower = target.obj;
          const r = C.TOWER_RESOURCE[tower.ref.type];
          const current = r.kind === "ammo" ? (tower.ref.ammo || 0) : (tower.ref.mana || 0);
          const max = r.kind === "ammo" ? tower.d.maxAmmo : tower.d.maxMana;
          const drain = Math.min(current, Math.max(5, Math.ceil(max * 0.18)));
          if (r.kind === "ammo") tower.ref.ammo = Math.max(0, current - drain);
          else tower.ref.mana = Math.max(0, current - drain);
          tower.ref.warlockDebuff = 3;
          this._float(tower.x, tower.y - 22, "DRAIN -" + drain, e.color);
          this.effects.push({ kind: "immune", x: tower.x, y: tower.y, r: 15, life: 0.45, color: e.color });
          e.abilityCd = 4.5;
        } else {
          e.abilityCd = 1;
        }
      }
    }
    const moveSpeed =
      e.type === "goblin" ? e.speed * 1.18 * commanderBoost :
      e.type === "darkElf" ? e.speed * 1.08 * commanderBoost :
      e.type === "slime" ? e.speed * 0.92 * commanderBoost :
      e.type === "reaper" ? e.speed * 1.05 * commanderBoost :
      e.speed * commanderBoost;

    // Floating enemies bypass barricades, preserving their distinct identity.
    // Reapers and lieutenants can peel toward heroes; orcs pressure towers.
    if (tactical && (e.type === "reaper" || e.type === "orc" || e.type === "lieutenant" || e.type === "ghost" || e.type === "darkElf" || e.type === "warlock")) {
      const target = tactical.obj;
      const dist = Math.hypot(target.x - e.x, target.y - e.y) || 1;
      const attackRange = e.type === "reaper" ? 34 : e.type === "darkElf" ? 38 : e.type === "warlock" ? 38 : 30;
      if (dist <= attackRange) {
        if (e.atkCd <= 0) {
          this._enemyAttack(e, tactical);
          e.atkCd = e.type === "reaper" ? 0.72 : e.type === "darkElf" ? 0.8 : e.type === "orc" ? 1.15 : 0.9;
        }
        return;
      }
      // Reapers deliberately pursue wounded heroes; other tactical enemies
      // only peel when their preferred target is reasonably close.
      const peelRange = e.type === "reaper" ? 260 : e.type === "darkElf" ? 300 : e.type === "warlock" ? 300 : 150;
      if (dist <= peelRange) {
        e.x += ((target.x - e.x) / dist) * moveSpeed * dt;
        e.y += ((target.y - e.y) / dist) * moveSpeed * dt;
        return;
      }
    }

    // barricade in lane?
    const bar = this.barricades[e.lane];
    if (!e.floats && bar && bar.ref.hp > 0 && Math.abs(e.y - WALL_Y) < 16 && e.y < WALL_Y + 4) {
      if (e.atkCd <= 0) {
        bar.ref.hp = Math.max(0, bar.ref.hp - e.damage);
        e.hp = Math.max(0, e.hp - C.BARRICADE.collisionDamage);
        e.atkCd = e.type === "orc" ? 1.15 : e.type === "goblin" ? 0.65 : 0.8;
        if (e.hp <= 0) { this._killEnemy(e, null); return; }
      }
      return;
    }

    // Existing wave objectives still matter when an enemy reaches a defender.
    let blocker = null;
    if (e.objective === "towers") blocker = this._nearestTower(e.x, e.y, 46);
    if (!blocker) blocker = this._nearestHeroEntity(e.x, e.y, 30);
    if (blocker) {
      if (e.atkCd <= 0) {
        this._enemyAttack(e, blocker);
        e.atkCd = e.type === "reaper" ? 0.72 : e.type === "goblin" ? 0.65 : e.type === "orc" ? 1.15 : 1.0;
      }
      return;
    }
    // advance downward
    e.y += moveSpeed * dt;
    if (e.y >= CASTLE_Y) {
      // Reaching the castle is a permanent breach. Track every escaped enemy
      // so a wave cannot be won simply because the remaining defenders died.
      this.castleEscaped += 1;
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
      const damage = e.type === "darkElf" ? e.damage * 1.15 : e.damage;
      t.ref.hp = Math.max(0, t.ref.hp - damage);
      if (t.ref.hp <= 0) {
        this.sim.morale = clamp(this.sim.morale + C.MORALE.towerDestroyed);
        this.effects.push({ x: t.x, y: t.y, r: 30, life: 0.4, color: t.d.color });
      }
    } else {
      const h = blocker.obj;
      if (e.type === "warlock") {
        h.ref.shield = 0;
      }
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
      critChance: isHero ? (d.critChance ?? C.BASE_CRIT) : C.BASE_CRIT,
      critMult: isHero ? (d.critMult ?? C.CRIT_MULT) : C.CRIT_MULT,
      damageType: d.damageType || (src.ref?.cls === "knight" ? C.DAMAGE_TYPES.KNIGHT_MELEE
        : src.ref?.cls === "rouge" ? C.DAMAGE_TYPES.ROUGE_MELEE
        : src.ref?.cls === "archer" ? C.DAMAGE_TYPES.ARCHER_RANGED
        : d.magic ? C.DAMAGE_TYPES.ARCANE : C.DAMAGE_TYPES.ARCHER_RANGED),
      color: isHero ? d.color : d.color, t: 0,
    });
    this.effects.push({ x: src.x, y: src.y, r: 8, life: 0.18, color: d.color, ring: true });
  }

  _applyHit(p) {
    const e = p.target;
    const affinity = C.affinityMultiplier(e, p.damageType);
    if (affinity <= 0 || (p.magic && e.magicImmune)) {
      this._float(e.x, e.y - 4, "IMMUNE", "#39FF14");
      this.effects.push({ kind: "immune", x: e.x, y: e.y, r: 12, life: 0.32, color: "#39FF14" });
      return;
    }

    let dmg = p.dmg * affinity;
    const crit = Math.random() < (p.critChance ?? C.BASE_CRIT);
    if (crit) dmg *= (p.critMult ?? C.CRIT_MULT);

    e.hp = Math.max(0, e.hp - dmg);
    e.dmgBy[p.sourceId] = (e.dmgBy[p.sourceId] || 0) + dmg;

    const affinityColor =
      affinity >= 1.25 ? "#FF66CC" :
      affinity <= 0.3 ? "#FF8A00" :
      affinity <= 0.6 ? "#00F3FF" :
      "#FFFFFF";

    const label = crit ? "CRIT " + Math.round(dmg) : Math.round(dmg);
    this._float(e.x, e.y - 4, label, crit ? "#FFE600" : affinityColor);
    this.effects.push({
      kind: "hit",
      x: e.x,
      y: e.y,
      r: crit ? 15 : 10,
      life: crit ? 0.32 : 0.22,
      color: crit ? "#FFE600" : affinityColor,
      crit,
    });

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

    // Equipment drops are deposited directly into the community Vault.
    // The drop/rarity economy is tuned separately from the verified gear stats.
    const drop = rollEquipmentDrop(e, this.sim.wave || 1);
    if (drop) this.sim.vault.push(drop);

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
      for (let i = 0; i < this.heroes.length; i++) {
        if (this.heroes[i].alive) this._awardXp("H" + i, Math.round(tier.xp * 0.35));
      }
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
  _selectTowerTarget(tower) {
    const cfg = tower.d;
    const pool = this.active.filter((e) => Math.hypot(e.x - tower.x, e.y - tower.y) <= cfg.range);
    if (!pool.length) return null;
    if (cfg.targetPriority === "elite_boss") {
      return pool.reduce((best, e) => {
        if (!best) return e;
        const rank = e.boss ? 3 : e.tier === "elite" ? 2 : 1;
        const bestRank = best.boss ? 3 : best.tier === "elite" ? 2 : 1;
        return rank > bestRank || (rank === bestRank && e.maxHp > best.maxHp) ? e : best;
      }, null);
    }
    if (cfg.targetPriority === "vulnerable") {
      const viable = pool.filter((e) => C.affinityMultiplier(e, cfg.damageType) > 0);
      if (!viable.length) return null;
      return viable.reduce((best, e) => {
        if (!best) return e;
        const score = C.affinityMultiplier(e, cfg.damageType);
        const bestScore = C.affinityMultiplier(best, cfg.damageType);
        if (score !== bestScore) return score > bestScore ? e : best;
        return e.hp < best.hp ? e : best;
      }, null);
    }
    if (cfg.targetPriority === "cluster") {
      return pool.reduce((best, e) => {
        const radius = cfg.splash || 55;
        const score = this.active.filter((other) => other !== e && Math.hypot(other.x - e.x, other.y - e.y) <= radius).length;
        const bestScore = best ? this.active.filter((other) => other !== best && Math.hypot(other.x - best.x, other.y - best.y) <= radius).length : -1;
        return score > bestScore ? e : best;
      }, null);
    }
    return pool.reduce((best, e) => !best || Math.hypot(e.x - tower.x, e.y - tower.y) < Math.hypot(best.x - tower.x, best.y - tower.y) ? e : best, null);
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
    if (h.ref.cls === "mage") {
      const viable = pool.filter((e) => C.affinityMultiplier(e, C.DAMAGE_TYPES.ARCANE) > 0);
      if (viable.length) {
        return viable.reduce((best, e) => {
          if (!best) return e;
          const score = C.affinityMultiplier(e, C.DAMAGE_TYPES.ARCANE);
          const bestScore = C.affinityMultiplier(best, C.DAMAGE_TYPES.ARCANE);
          return score > bestScore || (score === bestScore && e.hp < best.hp) ? e : best;
        }, null);
      }
      return null;
    }
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
    let best = null, bd = r;
    for (const t of this.towers) {
      if (t.ref.hp <= 0) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= bd) { bd = d; best = t; }
    }
    return best ? { kind: "tower", obj: best } : null;
  }
  _nearestHeroEntity(x, y, r) {
    let best = null, bd = r;
    for (const h of this.heroes) if (h.alive) {
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= bd) { bd = d; best = h; }
    }
    return best ? { kind: "hero", obj: best } : null;
  }

  _nearestMageEntity(x, y, r) {
    let best = null, bd = r;
    for (const h of this.heroes) {
      if (!h.alive || h.ref?.type !== "mage") continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d <= bd) { bd = d; best = h; }
    }
    return best ? { kind: "hero", obj: best } : null;
  }

  _selectEnemyTacticalTarget(e) {
    if (e.type === "reaper") {
      let best = null, worst = Infinity;
      for (const h of this.heroes) {
        if (!h.alive) continue;
        const d = Math.hypot(h.x - e.x, h.y - e.y);
        if (d > 260) continue;
        const frac = h.ref.hp / Math.max(1, h.d.maxHp);
        if (frac < worst) { worst = frac; best = h; }
      }
      return best ? { kind: "hero", obj: best } : null;
    }

    if (e.type === "orc") {
      return this._nearestTower(e.x, e.y, 150) || this._nearestHeroEntity(e.x, e.y, 110);
    }

    if (e.type === "lieutenant") {
      return this._nearestHeroEntity(e.x, e.y, 150) || this._nearestTower(e.x, e.y, 120);
    }

    if (e.type === "ghost") {
      return this._nearestHeroEntity(e.x, e.y, 120) || this._nearestTower(e.x, e.y, 120);
    }

    if (e.type === "darkElf") {
      return this._nearestTower(e.x, e.y, 300) || this._nearestHeroEntity(e.x, e.y, 140);
    }

    if (e.type === "warlock") {
      return this._nearestMageEntity(e.x, e.y, 300)
        || this._nearestHeroEntity(e.x, e.y, 300)
        || this._nearestTower(e.x, e.y, 300);
    }

    return null;
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
      castleEscaped: this.castleEscaped,
      castleEscapeLimit: Math.floor(this.wave.total / 2) + 1,
      castleHp: this.sim.castleHp, castleMaxHp: this.sim.castleMaxHp,
      morale: this.sim.morale, gold: this.sim.gold, food: this.sim.food, stone: this.sim.stone,
      heroes: this.heroes.map((h) => ({ name: h.ref.name, hp: h.ref.hp, maxHp: h.d.maxHp, alive: h.alive, shield: h.ref.shield || 0 })),
      boss: (() => { const b = this.active.find((e) => e.boss); return b ? { name: b.name, hp: b.hp, maxHp: b.maxHp } : null; })(),
    });
  }

  _checkEnd() {
    if (this.ended) return;

    // Absolute defeat conditions. Towers are supporting defenses, but they are
    // not themselves a victory condition: once the entire hero squad is dead,
    // the wave is lost even if some towers remain.
    const anyHero = this.heroes.some((h) => h.alive);
    if (!anyHero) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: false,
        reason: "heroes",
        xpGains: this.xpGains,
        killed: this.killed,
      });
      return;
    }

    // The castle is lost either by HP depletion or by a strict majority of the
    // wave reaching it. Example: 10 enemies -> 6 breaches required; 9 -> 5.
    const castleEscapeLimit = Math.floor(this.wave.total / 2) + 1;
    if (this.sim.castleHp <= 0) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: false,
        reason: "castle",
        xpGains: this.xpGains,
        killed: this.killed,
      });
      return;
    }

    if (this.castleEscaped >= castleEscapeLimit) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: false,
        reason: "breach",
        xpGains: this.xpGains,
        killed: this.killed,
        castleEscaped: this.castleEscaped,
        castleEscapeLimit,
      });
      return;
    }

    // Victory requires the entire wave to be resolved while at least one hero
    // is still alive and the castle has not crossed either defeat threshold.
    if (this.spawnQueue.length === 0 && this.active.length === 0) {
      this.ended = true;
      this.stop();
      this.cb.onEnd && this.cb.onEnd({
        victory: true,
        reason: "cleared",
        xpGains: this.xpGains,
        killed: this.killed,
      });
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

    // towers — compact top-down gameplay sprites, weapon direction points UP toward enemies.
    for (const t of this.towers) {
      this._drawTowerSprite(t);
      this._bar(t.x - 18, t.y + 17, 36, 3, t.ref.hp / t.d.maxHp, t.d.color);
      const tr = C.TOWER_RESOURCE[t.ref.type];
      const cur = tr.kind === "ammo" ? (t.ref.ammo || 0) : (t.ref.mana || 0);
      const max = tr.kind === "ammo" ? t.d.maxAmmo : t.d.maxMana;
      this._bar(t.x - 18, t.y + 22, 36, 2, max > 0 ? cur / max : 0, "#FFE600");
    }

    // enemies — top-down sprites face DOWN toward the player/castle.
    for (const e of this.active) {
      const r = e.boss ? 25 : e.tier === "elite" ? 16 : 11;
      this._drawEnemySprite(e);
      this._bar(e.x - r, e.y - r - 7, r * 2, 3, e.hp / e.maxHp, e.color);
      if (e.type === "reaper" && e.hp > 0) {
        ctx.save();
        ctx.strokeStyle = "#A855F7";
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#A855F7";
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 4 + 2 * Math.sin(this.time * 6), 0, 7);
        ctx.stroke();
        ctx.restore();
      } else if (e.type === "darkElf" && e.hp > 0) {
        ctx.save(); ctx.strokeStyle = "#F43F5E"; ctx.lineWidth = 1.4; ctx.shadowBlur = 10; ctx.shadowColor = "#F43F5E";
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 5 + 2 * Math.sin(this.time * 8), 0, 7); ctx.stroke(); ctx.restore();
      } else if (e.type === "warlock" && e.hp > 0) {
        ctx.save(); ctx.strokeStyle = "#C026D3"; ctx.lineWidth = 1.4; ctx.shadowBlur = 10; ctx.shadowColor = "#C026D3"; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(e.x, e.y, r + 6, 0, 7); ctx.stroke(); ctx.restore();
      } else if (e.type === "lieutenant" && e.hp > 0) {
        ctx.save();
        ctx.strokeStyle = "#00F3FF";
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, 105, 0, 7);
        ctx.stroke();
        ctx.restore();
      }
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

    // heroes — top-down sprites face UP toward incoming enemies.
    for (const h of this.heroes) {
      if (h.i === this.selectedHero && h.alive) {
        ctx.save();
        ctx.strokeStyle = h.manual ? "#F0ABFC" : h.d.color;
        ctx.lineWidth = h.manual ? 2 : 1.5;
        ctx.shadowBlur = 12;
        ctx.shadowColor = h.manual ? "#D946EF" : h.d.color;
        ctx.beginPath();
        ctx.arc(h.x, h.y + 2, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      this._drawHeroSprite(h);
      this._bar(h.x - 18, h.y + 20, 36, 4, Math.max(0, h.ref.hp) / h.d.maxHp, h.d.color);
    }

    // Manual command markers make every battlefield command visually verifiable.
    for (const h of this.heroes) {
      if (!h.manual || !h.alive) continue;
      if (h.manualPoint) {
        ctx.save();
        ctx.strokeStyle = "#00F3FF";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00F3FF";
        ctx.beginPath();
        ctx.arc(h.manualPoint.x, h.manualPoint.y, 9 + 2 * Math.sin(this.time * 8), 0, Math.PI * 2);
        ctx.moveTo(h.manualPoint.x - 14, h.manualPoint.y); ctx.lineTo(h.manualPoint.x + 14, h.manualPoint.y);
        ctx.moveTo(h.manualPoint.x, h.manualPoint.y - 14); ctx.lineTo(h.manualPoint.x, h.manualPoint.y + 14);
        ctx.stroke();
        ctx.restore();
      }
      if (h.manualTarget && h.manualTarget.hp > 0) {
        ctx.save();
        ctx.strokeStyle = "#FFE600";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#FFE600";
        ctx.beginPath();
        ctx.arc(h.manualTarget.x, h.manualTarget.y, 18 + 2 * Math.sin(this.time * 9), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
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
      } else if (p.magic) {
        // Arcane shots are diamonds so they remain visually distinct from arrows.
        ctx.shadowBlur = 14; ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 5, p.y);
        ctx.lineTo(p.x, p.y + 5); ctx.lineTo(p.x - 5, p.y); ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 0.8; ctx.stroke();
      } else {
        // Physical shots get a short directional streak.
        ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        const dx = p.tx - p.x, dy = p.ty - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        ctx.beginPath();
        ctx.moveTo(p.x - ux * 7, p.y - uy * 7);
        ctx.lineTo(p.x + ux * 3, p.y + uy * 3);
        ctx.stroke();
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
      } else if (fx.kind === "hit") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = fx.crit ? 2.5 : 1.8;
        ctx.shadowBlur = 14; ctx.shadowColor = fx.color;
        const radius = fx.r + (1 - fx.life) * (fx.crit ? 12 : 8);
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, radius, 0, 7);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(fx.x - radius * 0.8, fx.y);
        ctx.lineTo(fx.x + radius * 0.8, fx.y);
        ctx.moveTo(fx.x, fx.y - radius * 0.8);
        ctx.lineTo(fx.x, fx.y + radius * 0.8);
        ctx.stroke();
      } else if (fx.kind === "immune") {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = fx.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 14; ctx.shadowColor = fx.color;
        const radius = fx.r + (1 - fx.life) * 10;
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, radius, 0, 7);
        ctx.moveTo(fx.x - radius, fx.y);
        ctx.lineTo(fx.x + radius, fx.y);
        ctx.moveTo(fx.x, fx.y - radius);
        ctx.lineTo(fx.x, fx.y + radius);
        ctx.stroke();
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

  _drawHeroSprite(h) {
    const ctx = this.ctx;
    const color = h.d.color;
    const alive = h.alive;
    const alpha = alive ? (h.protect > 0 ? 0.5 : 1) : 0.2;
    const cls = h.ref.cls;

    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    const stroke = () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
    };
    const fill = () => {
      ctx.fillStyle = color;
      ctx.fill();
    };

    if (cls === "knight") {
      // Back-facing helmet, cape, shield and sword all point toward the enemy lane (UP).
      ctx.beginPath();
      ctx.moveTo(-10, 9); ctx.lineTo(-8, -7); ctx.lineTo(0, -13);
      ctx.lineTo(8, -7); ctx.lineTo(10, 9); ctx.lineTo(5, 14);
      ctx.lineTo(-5, 14); ctx.closePath(); fill(); stroke();

      ctx.fillStyle = "#07111A";
      ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.stroke();

      ctx.fillStyle = "#101820";
      ctx.beginPath();
      ctx.moveTo(-14, 8); ctx.lineTo(-7, 4); ctx.lineTo(-6, 13); ctx.lineTo(-13, 15); ctx.closePath();
      ctx.fill(); stroke();

      ctx.strokeStyle = color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(7, 8); ctx.lineTo(12, -13); ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(10, -13); ctx.lineTo(12, -17); ctx.lineTo(14, -13); ctx.stroke();
    } else if (cls === "rouge") {
      // Hooded back silhouette with twin blades angled forward.
      ctx.beginPath();
      ctx.moveTo(-10, 12); ctx.lineTo(-8, -6); ctx.lineTo(0, -14);
      ctx.lineTo(8, -6); ctx.lineTo(10, 12); ctx.lineTo(0, 16); ctx.closePath();
      fill(); stroke();

      ctx.fillStyle = "#09020D";
      ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-7, 6); ctx.lineTo(-15, -12); ctx.moveTo(7, 6); ctx.lineTo(15, -12); ctx.stroke();
    } else if (cls === "mage") {
      // Robed back silhouette, staff and arcane orb pointed toward the enemy.
      ctx.beginPath();
      ctx.moveTo(-12, 13); ctx.lineTo(-8, -4); ctx.lineTo(0, -12);
      ctx.lineTo(8, -4); ctx.lineTo(12, 13); ctx.closePath();
      fill(); stroke();

      ctx.fillStyle = "#090313";
      ctx.beginPath(); ctx.arc(0, -6, 5, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(9, 13); ctx.lineTo(12, -12); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(12, -15, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-10, -13, 2.2, 0, Math.PI * 2); ctx.fill();
    } else {
      // Archer: hood/back silhouette, bow on the side, arrow aimed UP.
      ctx.beginPath();
      ctx.moveTo(-9, 13); ctx.lineTo(-8, -5); ctx.lineTo(0, -13);
      ctx.lineTo(8, -5); ctx.lineTo(9, 13); ctx.closePath();
      fill(); stroke();

      ctx.fillStyle = "#071305";
      ctx.beginPath(); ctx.arc(0, -5, 5, 0, Math.PI * 2); ctx.fill();

      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(10, 0, 10, -1.15, 1.15); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(10, 10); ctx.stroke();

      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(1, -3); ctx.lineTo(1, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1, -16); ctx.lineTo(-1, -12); ctx.moveTo(1, -16); ctx.lineTo(3, -12); ctx.stroke();
    }

    if (!alive) {
      ctx.strokeStyle = "#FF0055";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
    }
    ctx.restore();
  }

  _drawTowerSprite(t) {
    const ctx = this.ctx;
    const color = t.d.color;
    const active = t.ref.hp > 0;
    const alpha = active ? (t.ref.underfunded ? 0.45 : 1) : 0.18;

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;

    // Common tower base: every tower now reads as the same neon-defense family.
    ctx.fillStyle = "#111720";
    ctx.beginPath(); ctx.arc(0, 5, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    const mount = () => {
      ctx.fillStyle = "#1C2430";
      ctx.beginPath(); ctx.arc(0, 3, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.stroke();
    };
    const barrel = (width = 3) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowBlur = 8; ctx.shadowColor = color;
      ctx.beginPath(); ctx.moveTo(0, 3); ctx.lineTo(0, -21); ctx.stroke();
    };

    if (t.ref.type === "archer") {
      // Twin-arrow tower.
      mount(); barrel(2.5);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-7, -12); ctx.lineTo(0, -20); ctx.lineTo(7, -12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-4, -15); ctx.lineTo(-4, -23); ctx.moveTo(4, -15); ctx.lineTo(4, -23); ctx.stroke();
    } else if (t.ref.type === "catapult") {
      // Heavy siege frame and scoop.
      ctx.fillStyle = "#30251C";
      ctx.fillRect(-11, -1, 22, 10); ctx.strokeRect(-11, -1, 22, 10);
      ctx.strokeStyle = color; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -19); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -19, 5, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = "#080A0F"; ctx.beginPath(); ctx.arc(0, -19, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (t.ref.type === "wizard") {
      // Arcane crystal tower, intentionally distinct from physical weapons.
      ctx.fillStyle = "#1D1630";
      ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(-8, -8); ctx.lineTo(0, -17);
      ctx.lineTo(8, -8); ctx.lineTo(11, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = color; ctx.shadowBlur = 14; ctx.shadowColor = color;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, -4); ctx.lineTo(0, 4); ctx.lineTo(-6, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 1); ctx.stroke();
    } else {
      // Ballista: heavier, longer weapon profile for elite/boss hunting.
      ctx.fillStyle = "#25161A";
      ctx.fillRect(-12, -2, 24, 11); ctx.strokeRect(-12, -2, 24, 11);
      barrel(3.5);
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(10, -16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -20); ctx.lineTo(5, -20); ctx.stroke();
    }

    if (t.ref.underfunded && active) {
      ctx.strokeStyle = "#FFE600"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 5, 19, 0, Math.PI * 2); ctx.stroke();
    }

    if (!active) {
      ctx.strokeStyle = "#FF0055";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-11, -11); ctx.lineTo(11, 11); ctx.moveTo(11, -11); ctx.lineTo(-11, 11); ctx.stroke();
    }
    ctx.restore();
  }
  _drawEnemySprite(e) {
    const ctx = this.ctx;
    const color = e.color;
    const boss = !!e.boss;
    const elite = e.tier === "elite";
    const s = boss ? 1.85 : elite ? 1.35 : 1;

    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowBlur = boss ? 18 : elite ? 13 : 9;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;

    const outline = () => { ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.stroke(); };
    const neon = (width = 2) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowBlur = 8; ctx.shadowColor = color; };
    const eye = (x, y, r = 2) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };

    if (e.type === "ghost") {
      // Floating sheet silhouette with a clear face and trailing tail.
      ctx.fillStyle = "#10131D";
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.bezierCurveTo(-10, -12, -12, -3, -10, 6);
      ctx.lineTo(-7, 12); ctx.lineTo(-3, 7); ctx.lineTo(0, 13);
      ctx.lineTo(4, 7); ctx.lineTo(8, 12); ctx.lineTo(10, 5);
      ctx.bezierCurveTo(12, -5, 9, -12, 0, -14);
      ctx.closePath(); ctx.fill(); outline();
      eye(-3, 0, 2.2); eye(3, 0, 2.2);
      neon(1.4); ctx.beginPath(); ctx.moveTo(-3, 7); ctx.lineTo(0, 9); ctx.lineTo(3, 7); ctx.stroke();
    } else if (e.type === "slime") {
      // Low, translucent-looking toxic blob with crown-like drips.
      ctx.fillStyle = "#102016";
      ctx.beginPath();
      ctx.moveTo(-13, 8); ctx.quadraticCurveTo(-12, -5, -7, -9);
      ctx.quadraticCurveTo(0, -14, 7, -9); ctx.quadraticCurveTo(12, -5, 13, 8);
      ctx.lineTo(8, 11); ctx.lineTo(4, 8); ctx.lineTo(0, 13);
      ctx.lineTo(-4, 8); ctx.lineTo(-9, 11); ctx.closePath();
      ctx.fill(); outline();
      eye(-4, 0, 2); eye(4, 0, 2);
      neon(1.4); ctx.beginPath(); ctx.moveTo(-6, 5); ctx.quadraticCurveTo(0, 8, 6, 5); ctx.stroke();
    } else if (e.type === "goblin") {
      // Small angular raider: ears, brow, torso and a short blade.
      ctx.fillStyle = "#152016";
      ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(-8, -7); ctx.lineTo(0, -11);
      ctx.lineTo(8, -7); ctx.lineTo(7, 1); ctx.lineTo(5, 8); ctx.lineTo(-5, 8); ctx.closePath();
      ctx.fill(); outline();
      ctx.fillStyle = "#17261A";
      ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-16, -11); ctx.lineTo(-10, 1); ctx.closePath();
      ctx.moveTo(7, -5); ctx.lineTo(16, -11); ctx.lineTo(10, 1); ctx.closePath(); ctx.fill(); outline();
      eye(-3, 0, 1.8); eye(3, 0, 1.8);
      neon(2.3); ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(16, -5); ctx.stroke();
    } else if (e.type === "gnome") {
      // Same family as goblin, but with the distinctive tall neon cap.
      ctx.fillStyle = "#172019";
      ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, Math.PI * 2); ctx.fill(); outline();
      ctx.fillStyle = "#10171D";
      ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(0, -20); ctx.lineTo(9, -5); ctx.closePath(); ctx.fill(); outline();
      neon(1.2); ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -6); ctx.stroke();
      eye(-3, 3, 1.8); eye(3, 3, 1.8);
      neon(2); ctx.beginPath(); ctx.moveTo(7, 7); ctx.lineTo(14, -3); ctx.stroke();
    } else if (e.type === "skeleton") {
      // Minimal skull/ribcage silhouette — intentionally readable at small size.
      ctx.fillStyle = "#111922";
      ctx.beginPath(); ctx.arc(0, -5, 8.5, 0, Math.PI * 2); ctx.fill(); outline();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-3, -5, 2, 0, Math.PI * 2); ctx.arc(3, -5, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#111922";
      ctx.beginPath(); ctx.moveTo(-7, 3); ctx.lineTo(7, 3); ctx.lineTo(6, 12); ctx.lineTo(0, 15); ctx.lineTo(-6, 12); ctx.closePath(); ctx.fill();
      neon(1.4);
      for (let y = 5; y <= 11; y += 3) { ctx.beginPath(); ctx.moveTo(-5, y); ctx.lineTo(5, y); ctx.stroke(); }
      neon(2); ctx.beginPath(); ctx.moveTo(8, 9); ctx.lineTo(15, -8); ctx.stroke();
    } else if (e.type === "zombie") {
      // Slumped humanoid silhouette with a torn shoulder and reaching arm.
      ctx.fillStyle = "#171429";
      ctx.beginPath(); ctx.arc(0, -6, 8.5, 0, Math.PI * 2); ctx.fill(); outline();
      ctx.fillStyle = "#0E1420";
      ctx.beginPath(); ctx.moveTo(-7, 1); ctx.lineTo(7, 1); ctx.lineTo(9, 12); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill(); outline();
      eye(-3, -5, 2); eye(3, -3, 1.2);
      neon(2.3); ctx.beginPath(); ctx.moveTo(8, 5); ctx.lineTo(16, 1); ctx.lineTo(19, 6); ctx.stroke();
      neon(1.2); ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-10, 10); ctx.stroke();
    } else if (e.type === "orc") {
      // Broad armored brute with tusks and a heavy axe.
      ctx.fillStyle = "#101A16";
      ctx.beginPath(); ctx.moveTo(-11, -3); ctx.lineTo(-8, -11); ctx.lineTo(0, -14);
      ctx.lineTo(8, -11); ctx.lineTo(11, -3); ctx.lineTo(9, 10); ctx.lineTo(-9, 10); ctx.closePath();
      ctx.fill(); outline();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-9, 11); ctx.lineTo(-2, 9);
      ctx.moveTo(5, 5); ctx.lineTo(9, 11); ctx.lineTo(2, 9); ctx.fill();
      eye(-3, -1, 2); eye(3, -1, 2);
      neon(2.8); ctx.beginPath(); ctx.moveTo(9, 7); ctx.lineTo(16, -10); ctx.stroke();
      neon(2); ctx.beginPath(); ctx.moveTo(13, -14); ctx.lineTo(20, -10); ctx.stroke();
    } else if (e.type === "darkElf") {
      ctx.fillStyle = "#160A16";
      ctx.beginPath(); ctx.moveTo(-9, 11); ctx.lineTo(-8, -6); ctx.lineTo(0, -14); ctx.lineTo(8, -6); ctx.lineTo(9, 11); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = "#05050A"; ctx.beginPath(); ctx.arc(0, -3, 6, 0, Math.PI * 2); ctx.fill();
      eye(-3, -3, 2); eye(3, -3, 2);
      neon(2.3); ctx.beginPath(); ctx.moveTo(-7, 7); ctx.lineTo(-16, -7); ctx.moveTo(7, 7); ctx.lineTo(16, -7); ctx.stroke();
      neon(1.4); ctx.beginPath(); ctx.moveTo(-8, -7); ctx.lineTo(-15, -13); ctx.moveTo(8, -7); ctx.lineTo(15, -13); ctx.stroke();
    } else if (e.type === "warlock") {
      ctx.fillStyle = "#16091A";
      ctx.beginPath(); ctx.moveTo(-10, 12); ctx.lineTo(-9, -4); ctx.lineTo(0, -15); ctx.lineTo(9, -4); ctx.lineTo(10, 12); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = "#05030A"; ctx.beginPath(); ctx.arc(0, -5, 6, 0, Math.PI * 2); ctx.fill();
      eye(-3, -5, 1.8); eye(3, -5, 1.8);
      neon(2); ctx.beginPath(); ctx.moveTo(8, 12); ctx.lineTo(13, -15); ctx.stroke();
      ctx.fillStyle = color; ctx.shadowBlur = 14; ctx.shadowColor = color;
      ctx.beginPath(); ctx.arc(14, -18, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-9, 7, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (e.type === "reaper") {
      // Hooded elite with scythe — deliberately different from the lieutenant.
      ctx.fillStyle = "#12081B";
      ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(-9, -6); ctx.lineTo(0, -16);
      ctx.lineTo(9, -6); ctx.lineTo(10, 10); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = "#05050A";
      ctx.beginPath(); ctx.arc(0, -3, 6, 0, Math.PI * 2); ctx.fill();
      eye(-3, -2, 1.8); eye(3, -2, 1.8);
      neon(2.4); ctx.beginPath(); ctx.moveTo(7, 9); ctx.lineTo(17, -14); ctx.stroke();
      ctx.beginPath(); ctx.arc(19, -14, 7, Math.PI * 0.9, Math.PI * 1.8); ctx.stroke();
    } else if (e.type === "lieutenant") {
      // Armored elite commander with a ringed shoulder and spear.
      ctx.fillStyle = "#101923";
      ctx.beginPath(); ctx.moveTo(-11, 10); ctx.lineTo(-9, -7); ctx.lineTo(0, -15);
      ctx.lineTo(9, -7); ctx.lineTo(11, 10); ctx.closePath(); ctx.fill(); outline();
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(-3, -2, 1.8, 0, Math.PI * 2); ctx.arc(3, -2, 1.8, 0, Math.PI * 2); ctx.fill();
      neon(2.2); ctx.beginPath(); ctx.moveTo(8, 9); ctx.lineTo(14, -17); ctx.stroke();
      neon(1.6); ctx.beginPath(); ctx.arc(-12, 7, 6, 0, Math.PI * 2); ctx.stroke();
    } else {
      // Boss silhouettes keep a common Demonanic frame but have unique crowns.
      ctx.fillStyle = "#170A14";
      ctx.beginPath();
      ctx.moveTo(-21, 12); ctx.lineTo(-19, -5); ctx.lineTo(-30, -14);
      ctx.lineTo(-13, -12); ctx.lineTo(0, -20); ctx.lineTo(13, -12);
      ctx.lineTo(30, -14); ctx.lineTo(19, -5); ctx.lineTo(21, 12);
      ctx.lineTo(0, 20); ctx.closePath(); ctx.fill(); outline();
      eye(-9, 2, 2.8); eye(9, 2, 2.8);

      if (e.type === "demon") {
        neon(2.7);
        ctx.beginPath(); ctx.moveTo(-12, -10); ctx.lineTo(-23, -25);
        ctx.moveTo(12, -10); ctx.lineTo(23, -25); ctx.stroke();
        ctx.fillStyle = "#080309"; ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === "imperialNecromancer") {
        neon(1.7);
        ctx.beginPath(); ctx.arc(0, -7, 6, 0, Math.PI * 2);
        ctx.moveTo(-20, 3); ctx.lineTo(-13, -4); ctx.moveTo(20, 3); ctx.lineTo(13, -4); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -7, 3, 0, Math.PI * 2); ctx.fill();
      } else if (e.type === "nuclearBehemoth") {
        ctx.fillStyle = "#0A1710";
        ctx.beginPath(); ctx.arc(-11, 5, 6, 0, Math.PI * 2); ctx.arc(11, 5, 6, 0, Math.PI * 2); ctx.fill();
        neon(2.4);
        ctx.beginPath(); ctx.moveTo(-14, -10); ctx.lineTo(-22, -20); ctx.moveTo(14, -10); ctx.lineTo(22, -20); ctx.stroke();
      }
    }

    ctx.restore();
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
