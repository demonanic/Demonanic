// Real-time side-view combat engine + neon canvas renderer.
// Logical portrait resolution; enemies advance TOP -> DOWN to heroes at BOTTOM.
// Simulation is separate from React; mutates a cloned `sim` fragment and
// accumulates XP gains, returned to the UI at wave end.
import * as C from "./config";
import { heroDerived, towerDerived } from "./logic";

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
    this.heroes = sim.heroes.map((h, i) => {
      const d = heroDerived(h);
      return { i, ref: h, x: laneX(i === 3 ? 4 : i) , y: HERO_Y, d,
        cd: 0, alive: h.hp > 0, protect: 0 };
    });
    // spread 4 heroes across width
    const hxs = [W * 0.2, W * 0.4, W * 0.6, W * 0.8];
    this.heroes.forEach((h, i) => (h.x = hxs[i]));

    // tower runtime
    this.towers = [];
    sim.towers.forEach((t, slot) => {
      if (!t) return;
      const d = towerDerived(t);
      const p = SLOT_POS[slot];
      this.towers.push({ slot, ref: t, x: p.x, y: p.y, d, cd: 0 });
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

    // heroes attack
    for (const h of this.heroes) {
      if (!h.alive) continue;
      if (h.protect > 0) { h.protect -= dt; continue; }
      h.cd -= dt;
      const melee = h.d.range < 120;
      if (h.cd <= 0) {
        const target = this._nearestEnemy(h.x, h.y, h.d.range);
        // melee only engages once enemies breach the gate (attrition-then-engage)
        if (target && (!melee || target.y > GATE_Y - 40)) {
          this._fire("H" + h.i, h, target, h.d, true);
          h.cd = h.d.rate;
        }
      }
    }

    // projectiles
    for (const p of this.projectiles) {
      p.t += dt;
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.spd * dt;
      if (dist <= step || !p.target || p.target.hp <= 0) {
        if (p.target && p.target.hp > 0) this._applyHit(p);
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
    if (!blocker && e.y >= HERO_Y - 30) blocker = this._nearestHeroEntity(e.x, 42);
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
      let dmg = C.damageAfterDefense(e.damage, h.ref.stats.defense);
      if (Math.random() < h.d.dodge) { this._float(h.x, h.y - 20, "DODGE", "#00F3FF"); return; }
      h.ref.hp = Math.max(0, h.ref.hp - dmg);
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
  _nearestTower(x, y, r) {
    for (const t of this.towers) if (t.ref.hp > 0 && Math.hypot(t.x - x, t.y - y) <= r) return { kind: "tower", obj: t };
    return null;
  }
  _nearestHeroEntity(x, r) {
    let best = null, bd = r;
    for (const h of this.heroes) if (h.alive) { const d = Math.abs(h.x - x); if (d <= bd) { bd = d; best = h; } }
    return best ? { kind: "hero", obj: best } : null;
  }

  _float(x, y, text, color) { this.floaters.push({ x, y, text, color, life: 0.7 }); }

  _hud() {
    if (!this.cb.onHud) return;
    this.cb.onHud({
      total: this.wave.total, killed: this.killed,
      remaining: this.active.length + this.spawnQueue.length,
      castleHp: this.sim.castleHp, castleMaxHp: this.sim.castleMaxHp,
      morale: this.sim.morale, gold: this.sim.gold, food: this.sim.food, stone: this.sim.stone,
      heroes: this.heroes.map((h) => ({ name: h.ref.name, hp: h.ref.hp, maxHp: h.d.maxHp, alive: h.alive })),
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

    // tower slots + towers
    SLOT_POS.forEach((p, slot) => {
      const has = this.towers.find((t) => t.slot === slot);
      this._bracketSquare(p.x, p.y, 34, has ? has.d.color : "rgba(0,243,255,0.35)");
      if (has && has.ref.hp > 0) {
        this._glowShape(p.x, p.y, 11, has.d.color, has.ref.underfunded ? 0.4 : 1);
        this._bar(p.x - 16, p.y + 16, 32, 3, has.ref.hp / has.d.maxHp, has.d.color);
      }
    });

    // enemies
    for (const e of this.active) {
      const r = e.boss ? 22 : e.tier === "elite" ? 14 : 9;
      this._glowShape(e.x, e.y, r, e.color, 1, e.floats);
      if (e.boss) { // three-headed motif
        this._glowShape(e.x - 12, e.y - 6, 8, e.color, 1);
        this._glowShape(e.x + 12, e.y - 6, 8, e.color, 1);
      }
      this._bar(e.x - r, e.y - r - 5, r * 2, 3, e.hp / e.maxHp, e.color);
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
      ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.magic ? 4 : 3, 0, 7); ctx.fill();
      ctx.restore();
    }
    // effects
    for (const fx of this.effects) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fx.life * 2.2);
      ctx.strokeStyle = fx.color; ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = fx.color;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1 - fx.life), 0, 7); ctx.stroke();
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
