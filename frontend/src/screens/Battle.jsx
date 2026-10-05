import { useEffect, useRef, useState } from "react";
import { useGame } from "@/context/GameProvider";
import { Engine, LAYOUT } from "@/game/engine";
import { HeroCard, TowerCard } from "@/components/cards";
import TacticalMenu from "@/components/TacticalMenu";
import DebugPanel from "@/components/DebugPanel";
import { NeonButton, StatBar, HeroMiniSprite, getTacticalHudOpaque, setTacticalHudOpaque } from "@/components/ui-kit";
import { Coins, Terminal, Skull, Crosshair } from "lucide-react";
import { TIME } from "@/game/config";
import * as C from "@/game/config";
import {
  chargeUpkeep, buildWave, completeWave, addHeroXp, addTowerXp, makeSingleEnemy,
} from "@/game/logic";

export default function Battle() {
  const { state, mutate, setScreen, setLastResult } = useGame();
  const canvasRef = useRef();
  const engineRef = useRef();
  const simRef = useRef();
  const hudThrottle = useRef(0);
  const slowTimer = useRef();
  const endedRef = useRef(false);
  const waveNum = useRef(state?.wave || 1);

  const [phase, setPhase] = useState("scout");
  const [count, setCount] = useState(TIME.scoutCountdown);
  const [hud, setHud] = useState(null);
  const [openHero, setOpenHero] = useState(null);
  const [openTower, setOpenTower] = useState(null);
  const [slowed, setSlowed] = useState(false);
  const [debug, setDebug] = useState(false);
  const [selectedManualHero, setSelectedManualHero] = useState(null);
  const [tacticalOpen, setTacticalOpen] = useState(false);
  const [commandMode, setCommandMode] = useState("move");
  const [hudOpaque, setHudOpaque] = useState(false);
  const [, forceTick] = useState(0);

  useEffect(() => {
    const sim = structuredClone(state);
    chargeUpkeep(sim);
    simRef.current = sim;
    waveNum.current = state.wave;
    const wave = buildWave(state);
    const engine = new Engine(canvasRef.current, sim, wave, {
      onHud: (h) => {
        const now = performance.now();
        if (now - hudThrottle.current > 90) { hudThrottle.current = now; setHud(h); }
      },
      onEnd: (res) => onEnd(res),
    });
    engineRef.current = engine;

    const firstManual = state.heroes.findIndex((h) => h.manual);
    setSelectedManualHero(firstManual >= 0 ? firstManual : null);
    setHudOpaque(getTacticalHudOpaque());
    if (firstManual >= 0) engine.setSelectedHero(firstManual);

    let c = TIME.scoutCountdown;
    setCount(c);
    const iv = setInterval(() => {
      c -= 1; setCount(c);
      if (c <= 0) { clearInterval(iv); setPhase("combat"); engine.start(); }
    }, 1000);

    return () => { clearInterval(iv); engine.stop(); if (slowTimer.current) clearTimeout(slowTimer.current); };
    // eslint-disable-next-line
  }, []);

  const onEnd = (res) => {
    if (endedRef.current) return;
    endedRef.current = true;
    const sim = simRef.current;
    const gainsHeroes = { ...res.xpGains.heroes };
    const gainsTowers = { ...res.xpGains.towers };
    const preLevels = state.heroes.map((h) => h.level);
    mutate((s) => {
      s.gold = sim.gold; s.food = sim.food; s.stone = sim.stone;
      s.morale = sim.morale; s.castleHp = sim.castleHp; s.kills = sim.kills;
      s.heroes.forEach((h, i) => {
        h.hp = sim.heroes[i].hp;
        h.manual = !!sim.heroes[i].manual;
        h.attackConfig = sim.heroes[i].attackConfig;
      });
      s.towers.forEach((t, i) => { if (t && sim.towers[i]) t.hp = sim.towers[i].hp; });
      for (const i in gainsHeroes) addHeroXp(s.heroes[i], gainsHeroes[i]);
      for (const slot in gainsTowers) if (s.towers[slot]) addTowerXp(s.towers[slot], gainsTowers[slot]);
      s.towers = s.towers.filter((t) => t.hp > 0); // destroyed towers free their capacity
      s.bests.totalKills = Math.max(s.bests.totalKills || 0, s.kills.total);
      if (res.victory) completeWave(s);
    });
    const totalXp = Object.values(gainsHeroes).reduce((a, b) => a + b, 0) + Object.values(gainsTowers).reduce((a, b) => a + b, 0);
    setLastResult({
      victory: res.victory, wave: waveNum.current, killed: res.killed,
      totalXp: Math.round(totalXp),
      goldAfter: Math.round(sim.gold), foodAfter: Math.round(sim.food), stoneAfter: Math.round(sim.stone),
      morale: Math.round(sim.morale), castleHp: Math.round(sim.castleHp),
      leveledUp: state.heroes.filter((h, i) => C.heroLevelForXp((h.xp || 0) + (gainsHeroes[i] || 0)) > preLevels[i]).length,
    });
    setScreen("results");
  };

  const triggerSlow = () => {
    if (!engineRef.current || phase !== "combat") return;
    engineRef.current.setSpeed(TIME.slowdownFactor); setSlowed(true);
    if (slowTimer.current) clearTimeout(slowTimer.current);
    slowTimer.current = setTimeout(() => {
      if (engineRef.current) engineRef.current.setSpeed(1); setSlowed(false);
    }, TIME.tacticalSlowdown * 1000);
  };

  const endSlow = () => {
    if (slowTimer.current) clearTimeout(slowTimer.current);
    if (engineRef.current) engineRef.current.setSpeed(1); setSlowed(false);
  };

  const openHeroCard = (i) => {
    setTacticalOpen(false);
    setOpenHero(i);
    triggerSlow();
  };

  const openTowerCard = (slot) => { setOpenTower(slot); triggerSlow(); };
  const closeCard = () => { setOpenHero(null); setOpenTower(null); endSlow(); };

  const selectManualHero = (i) => {
    const hero = state.heroes[i];
    if (!hero) return;
    setSelectedManualHero(i);
    engineRef.current?.setSelectedHero(i);
    setOpenHero(null);
    setOpenTower(null);
    setTacticalOpen(true);
    forceTick((t) => t + 1);
  };

  const retreatHero = (i) => {
    if (engineRef.current?.retreatHero(i)) {
      setSelectedManualHero(i);
      forceTick((t) => t + 1);
    }
  };

  const rallyHeroes = (i) => {
    if (engineRef.current?.rallyHeroes(i)) {
      setSelectedManualHero(i);
      forceTick((t) => t + 1);
    }
  };

  const reviveHero = (i) => {
    if (engineRef.current?.reviveHero(i)) {
      const revived = simRef.current?.heroes?.[i];
      if (revived) {
        state.heroes[i].hp = revived.hp;
        state.heroes[i].manual = false;
        state.gold = simRef.current.gold;
      }
      setSelectedManualHero(i);
      forceTick((t) => t + 1);
    }
  };

  const enableManual = (i) => {
    if (!engineRef.current) return;
    if (engineRef.current.setHeroManual(i, true)) {
      setSelectedManualHero(i);
      engineRef.current.setSelectedHero(i);
      setCommandMode("move");
      forceTick((t) => t + 1);
    }
  };

  const enableAuto = (i) => {
    if (!engineRef.current) return;
    if (engineRef.current.setHeroManual(i, false)) {
      if (selectedManualHero === i) setSelectedManualHero(null);
      forceTick((t) => t + 1);
    }
  };

  const toggleCombatMode = (i, mode) => {
    const manual = mode === "manual";
    if (engineRef.current) engineRef.current.setHeroManual(i, manual);
    if (simRef.current?.heroes[i]) simRef.current.heroes[i].manual = manual;
    state.heroes[i].manual = manual;
    if (manual) setSelectedManualHero(i);
    else if (selectedManualHero === i) setSelectedManualHero(null);
    forceTick((t) => t + 1);
  };

  const handleBattlefieldPointerDown = (e) => {
    if (phase !== "combat" || !engineRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Convert the phone's CSS pixels back into the engine's 420x760 logical space.
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    const heroIndex = selectedManualHero;
    if (heroIndex == null || !state.heroes[heroIndex] || state.heroes[heroIndex].hp <= 0) return;

    // A battlefield command is an explicit manual-control gesture. This removes
    // the old requirement to press MANUAL first, which was easy to miss on phone.
    if (!engineRef.current.heroes[heroIndex]?.manual) {
      engineRef.current.setHeroManual(heroIndex, true);
      setSelectedManualHero(heroIndex);
    }

    const accepted = commandMode === "target"
      ? engineRef.current.commandHeroAttackAt(heroIndex, x, y)
      : engineRef.current.commandHeroMoveTo(heroIndex, x, y);

    if (accepted) {
      engineRef.current.setSelectedHero(heroIndex);
      forceTick((t) => t + 1);
    }
  };

  const toggleHudOpaque = () => {
    const next = !hudOpaque;
    setHudOpaque(next);
    setTacticalHudOpaque(next);
  };

  const battleActions = {
    spawn: (t) => engineRef.current && engineRef.current.injectEnemy(makeSingleEnemy(simRef.current, t)),
    forceBoss: () => engineRef.current && engineRef.current.injectEnemy(makeSingleEnemy(simRef.current, "demon")),
    forceDefeat: () => engineRef.current && engineRef.current.forceDefeat(),
    forceWin: () => engineRef.current && engineRef.current.forceWin(),
  };

  if (!state) return null;
  const sim = simRef.current;

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* top enemy HUD */}
      <div className="p-2 flex items-center gap-2 text-xs font-mono-g border-b border-white/10" data-testid="enemy-hud">
        <Skull size={16} className="text-rose-500" />
        <span className="text-rose-400">WAVE {waveNum.current}</span>
        {hud && <>
          <span className="text-slate-400">KILLED <b className="text-green-400">{hud.killed}</b></span>
          <span className="text-slate-400">LEFT <b className="text-yellow-300">{hud.remaining}</b>/{hud.total}</span>
        </>}
        <div className="ml-auto flex gap-2 items-center">
          <span className="flex items-center gap-1 text-yellow-300"><Coins size={12} />{Math.round((hud?.gold ?? sim?.gold) || 0)}</span>
          <NeonButton color="green" className="!px-2 !py-1" onClick={() => setDebug(true)} data-testid="debug-toggle-panel"><Terminal size={13} /></NeonButton>
        </div>
      </div>

      {/* castle + morale bars */}
      {hud && (
        <div className="px-3 py-1.5 flex gap-3 items-center border-b border-white/5">
          <div className="flex-1">
            <div className="font-mono-g text-[9px] text-slate-400">CASTLE {Math.round(hud.castleHp)}/{hud.castleMaxHp}</div>
            <StatBar frac={hud.castleHp / hud.castleMaxHp} color="#FF0055" height={5} />
          </div>
          <div className="flex-1">
            <div className="font-mono-g text-[9px] text-slate-400">MORALE {Math.round(hud.morale)}</div>
            <StatBar frac={hud.morale / 100} color={hud.morale <= 0 ? "#FF0055" : "#39FF14"} height={5} />
          </div>
        </div>
      )}

      {/* boss health bar */}
      {hud?.boss && (
        <div className="px-3 py-1.5 border-b border-rose-500/30 bg-rose-950/20" data-testid="boss-hud">
          <div className="font-mono-g text-[10px] text-rose-400 flex items-center gap-1 animate-pulse-glow">
            <Skull size={12} /> {hud.boss.name.toUpperCase()} · {Math.round(hud.boss.hp)}/{Math.round(hud.boss.maxHp)}
          </div>
          <StatBar frac={hud.boss.hp / hud.boss.maxHp} color="#FF0055" height={7} />
        </div>
      )}

      {/* battlefield */}
      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden min-h-0">
        <canvas
          ref={canvasRef}
          width={LAYOUT.W}
          height={LAYOUT.H}
          onPointerDown={handleBattlefieldPointerDown}
          data-testid="battlefield-canvas"
          className="h-full max-h-full cursor-crosshair"
          style={{
            aspectRatio: `${LAYOUT.W}/${LAYOUT.H}`,
            imageRendering: "auto",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />

        {phase === "combat" && selectedManualHero != null && state.heroes[selectedManualHero]?.manual && (
          <div className={"absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded border border-fuchsia-400/50 font-mono-g text-[8px] text-fuchsia-300 tracking-wider pointer-events-none " + (hudOpaque ? "bg-[#090b12]" : "bg-black/75 backdrop-blur-sm")}>
            MANUAL · {state.heroes[selectedManualHero].name.toUpperCase()} · {commandMode === "move" ? "MOVE MODE" : "TARGET MODE"}
          </div>
        )}

        {phase === "scout" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="scout-countdown">
            <div className="font-mono-g text-cyan-400 text-xs tracking-[0.35em] mb-2 animate-pulse-glow">ENEMY SCOUTS PROBING DEFENSES</div>
            <div className="font-display font-black text-8xl text-fuchsia-500 text-glow-magenta">{count}</div>
            <div className="font-mono-g text-slate-400 text-xs mt-2">Wave {waveNum.current} incoming...</div>
          </div>
        )}

        {/* Floating tactical HUD: stays in one corner so the battlefield remains visible. */}
        {!tacticalOpen && (
          <button
            onClick={() => {
              setOpenHero(null);
              setOpenTower(null);
              endSlow();
              setTacticalOpen(true);
            }}
            className="absolute right-2 bottom-2 z-40 rounded-full border border-fuchsia-400/45 bg-black/50 backdrop-blur-md px-3 py-2 shadow-[0_0_18px_rgba(217,70,239,0.12)] text-fuchsia-300 font-mono-g text-[8px] tracking-wider flex items-center gap-1.5"
            data-testid="tactical-command-toggle"
          >
            <Crosshair size={12} />
            TACTICAL
          </button>
        )}

        <TacticalMenu
          open={tacticalOpen}
          onClose={() => setTacticalOpen(false)}
          heroes={state.heroes}
          selectedHero={selectedManualHero}
          commandMode={commandMode}
          onSelectHero={(i) => {
            setSelectedManualHero(i);
            engineRef.current?.setSelectedHero(i);
            forceTick((t) => t + 1);
          }}
          onManual={enableManual}
          onAuto={enableAuto}
          onCommandMode={setCommandMode}
          gold={sim?.gold ?? state.gold}
          onRetreat={retreatHero}
          onRally={rallyHeroes}
          onRevive={reviveHero}
          onDetails={openHeroCard}
          opaque={hudOpaque}
          onToggleOpaque={toggleHudOpaque}
        />
      </div>

      {/* tower quick access */}
      <div className="px-2 py-1 flex gap-1.5 border-t border-white/10 overflow-x-auto no-scrollbar" data-testid="tower-rack">
        {state.towers.map((tw, slot) => tw ? (
          <button key={slot} onClick={() => openTowerCard(slot)} data-testid={`battle-tower-${slot}`}
            className="shrink-0 bracket rounded px-2 py-1 flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ background: C.TOWERS[tw.type].color, boxShadow: `0 0 8px ${C.TOWERS[tw.type].color}` }} />
            <span className="font-mono-g text-[9px] text-slate-300">L{tw.level}</span>
          </button>
        ) : null)}
      </div>

      {/* hero portraits */}
      <div className="p-2 grid grid-cols-4 gap-2 border-t border-white/10" data-testid="hero-portraits">
        {(hud?.heroes || state.heroes.map((h) => ({ name: h.name, hp: h.hp, maxHp: h.maxHp, alive: h.hp > 0 }))).map((h, i) => {
          const cls = C.HERO_CLASSES[state.heroes[i].cls];
          return (
            <button
              key={i}
              onClick={() => selectManualHero(i)}
              data-testid={`battle-hero-${i}`}
              className={`glass-card rounded-lg p-1.5 flex flex-col items-center ${
                selectedManualHero === i ? "ring-1 ring-fuchsia-400" : ""
              }`}
              style={{ borderBottom: `2px solid ${cls.color}`, opacity: h.alive ? 1 : 0.35 }}
            >
              <HeroMiniSprite cls={state.heroes[i].cls} color={cls.color} size="sm" dead={!h.alive} />
              <span className="font-mono-g text-[9px]" style={{ color: cls.color }}>{cls.name}</span>
              <StatBar frac={(h.hp || 0) / (h.maxHp || 1)} color={cls.color} height={3} />
              {state.heroes[i].manual && <span className="font-mono-g text-[8px] text-fuchsia-400">MANUAL</span>}
            </button>
          );
        })}
      </div>

      {openHero != null && sim && (
        <HeroCard
          hero={sim.heroes[openHero]}
          editable={false}
          slowed={slowed}
          combatMode={sim.heroes[openHero].manual ? "manual" : "auto"}
          onCombatMode={(mode) => toggleCombatMode(openHero, mode)}
          onRetreat={() => retreatHero(openHero)}
          onRally={() => rallyHeroes(openHero)}
          onAlloc={() => {}}
          onPerk={() => {}}
          onConfig={(cfg) => {
            sim.heroes[openHero].attackConfig = cfg;
            sim.heroes[openHero].manual = true;
            state.heroes[openHero].attackConfig = cfg;
            state.heroes[openHero].manual = true;
            if (engineRef.current) engineRef.current.setHeroManual(openHero, true);
            setSelectedManualHero(openHero);
            forceTick((t) => t + 1);
          }}
          onClose={closeCard}
        />
      )}

      {openTower != null && sim && sim.towers[openTower] && (
        <TowerCard tower={sim.towers[openTower]} editable={false} slowed={slowed} onUpgrade={() => {}} onClose={closeCard} />
      )}

      {debug && <DebugPanel onClose={() => setDebug(false)} battleActions={battleActions} />}
    </div>
  );
}
