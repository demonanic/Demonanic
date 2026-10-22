import { useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameProvider";
import { Engine, LAYOUT } from "../game/engine";
import { HeroCard, TowerCard } from "../components/cards";
import TacticalMenu from "../components/TacticalMenu";
import DebugPanel from "../components/DebugPanel";
import { NeonButton, StatBar, TowerIcon, getTacticalHudOpaque, setTacticalHudOpaque } from "../components/ui-kit";
import { Coins, Terminal, Skull, Heart, X } from "lucide-react";
import { toast } from "sonner";
import { TIME } from "../game/config";
import * as C from "../game/config";
import {
  chargeUpkeep, buildWave, completeWave, addHeroXp, addTowerXp, makeSingleEnemy,
  activateGuildBlockade, guildBlockadeStatus,
} from "../game/logic";

export default function Battle() {
  const { state, mutate, setScreen, setLastResult } = useGame();
  const hasClasslessHeroes = state?.heroes?.some((hero) => !hero.cls && hero.combat);
  const canvasRef = useRef();
  const engineRef = useRef();
  const simRef = useRef();
  const hudThrottle = useRef(0);
  const slowTimer = useRef();
  const actionNoticeTimer = useRef();
  const endedRef = useRef(false);
  const phaseRef = useRef("scout");
  const pendingActionRef = useRef(null);
  const revivalDismissedRef = useRef(false);
  const waveNum = useRef(state?.wave || 1);
  const battleHeroIds = useRef([]);

  const [phase, setPhase] = useState("scout");
  const [count, setCount] = useState(TIME.scoutCountdown);
  const [hud, setHud] = useState(null);
  const [openHero, setOpenHero] = useState(null);
  const [openTower, setOpenTower] = useState(null);
  const [slowed, setSlowed] = useState(false);
  const [debug, setDebug] = useState(false);
  const [selectedManualHero, setSelectedManualHero] = useState(null);
  const [tacticalOpen, setTacticalOpen] = useState(false);
  const [selectionActive, setSelectionActive] = useState(false);
  const [actionTargeting, setActionTargeting] = useState(null);
  const [areaAim, setAreaAim] = useState(null);
  const [targetFeedback, setTargetFeedback] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [commandMode, setCommandMode] = useState("move");
  const [hudOpaque, setHudOpaque] = useState(false);
  const [showRevivalOffer, setShowRevivalOffer] = useState(false);
  const [blockadeNow, setBlockadeNow] = useState(Date.now());
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setBlockadeNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasClasslessHeroes) { setScreen("prep"); return; }
    if (!state) return;
    const sim = structuredClone(state);
    battleHeroIds.current = (sim.heroes || []).map((hero) => hero.id);
    chargeUpkeep(sim);
    simRef.current = sim;
    waveNum.current = state.wave;
    const wave = buildWave(state);
    const engine = new Engine(canvasRef.current, sim, wave, {
      onHud: (h) => {
        const now = performance.now();
        if (now - hudThrottle.current > 90) { hudThrottle.current = now; setHud(h); }
        const alive = (h.heroes || []).filter((hero) => hero.alive).length;
        if (alive > 1) revivalDismissedRef.current = false;
        if (alive === 1 && (h.heroes || []).some((hero) => !hero.alive) && !revivalDismissedRef.current) {
          setShowRevivalOffer(true);
        } else if (alive !== 1) {
          setShowRevivalOffer(false);
        }
      },
      onActionResolved: ({ index, result }) => {
        if (pendingActionRef.current?.heroIndex !== index) return;
        const completedAction = pendingActionRef.current;
        pendingActionRef.current = null;
        setActionTargeting(null);
        setAreaAim(null);
        setSelectionActive(false);
        setTargetFeedback("");
        announceAction(`${completedAction.kind.toUpperCase()} ${result === "cancelled" ? "CANCELLED" : "COMPLETE"}`);
        forceTick((t) => t + 1);
      },
      onEnd: (res) => onEnd(res),
    });
    engineRef.current = engine;

    const firstManual = state.heroes.findIndex((h) => h.manual);
    const firstSelected = firstManual >= 0 ? firstManual : state.heroes.length ? 0 : null;
    setSelectedManualHero(firstSelected);
    setHudOpaque(getTacticalHudOpaque());
    if (firstSelected != null) engine.setSelectedHero(firstSelected);

    let c = TIME.scoutCountdown;
    setCount(c);
    const iv = setInterval(() => {
      c -= 1; setCount(c);
      if (c <= 0) { clearInterval(iv); phaseRef.current = "combat"; setPhase("combat"); engine.start(); }
    }, 1000);

    return () => {
      clearInterval(iv);
      engine.stop();
      if (slowTimer.current) clearTimeout(slowTimer.current);
      if (actionNoticeTimer.current) clearTimeout(actionNoticeTimer.current);
    };
    // eslint-disable-next-line
  }, []);

  const onEnd = (res) => {
    if (endedRef.current) return;
    endedRef.current = true;
    pendingActionRef.current = null;
    setActionTargeting(null);
    setAreaAim(null);
    setTacticalOpen(false);
    setSelectionActive(false);
    setShowRevivalOffer(false);
    forceTick((t) => t + 1);
    const sim = simRef.current;

    // Re-check defeat conditions at the React boundary. This prevents a
    // stale/incorrect engine result from ever being displayed as a clear.
    const anyHeroAlive = (sim?.heroes || []).some((h) => h.hp > 0);
    const castleEscapeLimit = Math.floor((res.total || 0) / 2) + 1;
    const breach = Number(res.castleEscaped || 0) >= castleEscapeLimit;
    let finalVictory = !!res.victory;
    let finalReason = res.reason || (finalVictory ? "cleared" : "castle");

    if (!anyHeroAlive) {
      finalVictory = false;
      finalReason = "heroes";
    } else if (sim && sim.castleHp <= 0) {
      finalVictory = false;
      finalReason = "castle";
    } else if (breach) {
      finalVictory = false;
      finalReason = "breach";
    }
    const gainsHeroes = { ...res.xpGains.heroes };
    const gainsTowers = { ...res.xpGains.towers };
    const preLevels = new Map((state.heroes || []).map((h) => [h.id, h.level]));
    mutate((s) => {
      s.gold = sim.gold; s.metal = sim.metal; s.stone = sim.stone;
      s.morale = sim.morale; s.castleHp = sim.castleHp; s.kills = sim.kills;
      s.vault = sim.vault || s.vault || [];
      s.buildings = structuredClone(sim.buildings || s.buildings || {});
      s.barricades = structuredClone(sim.barricades || s.barricades || []);
      s.shoppe = sim.shoppe || s.shoppe;
      s.guildBlockadeLevel = sim.guildBlockadeLevel || 0;
      s.guildBlockadeActiveUntil = sim.guildBlockadeActiveUntil || 0;
      s.guildBlockadeCooldownUntil = sim.guildBlockadeCooldownUntil || 0;
      // The completion prompt may change the saved lineup during combat. Merge
      // runtime results by stable hero ID so the current wave cannot corrupt swaps.
      const simHeroesById = new Map((sim.heroes || []).map((hero) => [hero.id, hero]));
      for (const h of [...(s.heroes || []), ...(s.bench || [])]) {
        const runtime = simHeroesById.get(h.id);
        if (!runtime) continue;
        h.hp = runtime.hp;
        h.manual = !!runtime.manual;
        h.attackConfig = runtime.attackConfig;
      }
      s.towers.forEach((t, i) => {
        if (!t || !sim.towers[i]) return;
        t.hp = sim.towers[i].hp;
        t.ammo = sim.towers[i].ammo;
        t.mana = sim.towers[i].mana;
        t.maxAmmo = sim.towers[i].maxAmmo;
        t.maxMana = sim.towers[i].maxMana;
      });
      for (const i in gainsHeroes) {
        const heroId = battleHeroIds.current[Number(i)];
        const hero = [...(s.heroes || []), ...(s.bench || [])].find((item) => item.id === heroId);
        if (hero) addHeroXp(hero, gainsHeroes[i]);
      }
      for (const slot in gainsTowers) if (s.towers[slot]) addTowerXp(s.towers[slot], gainsTowers[slot]);
      s.towers = s.towers.filter((t) => t.hp > 0); // destroyed towers free their capacity
      s.bests.totalKills = Math.max(s.bests.totalKills || 0, s.kills.total);
      if (finalVictory) completeWave(s, waveNum.current);
    });
    const totalXp = Object.values(gainsHeroes).reduce((a, b) => a + b, 0) + Object.values(gainsTowers).reduce((a, b) => a + b, 0);
    setLastResult({
      victory: finalVictory,
      reason: finalReason,
      wave: waveNum.current, killed: res.killed,
      totalXp: Math.round(totalXp),
      goldAfter: Math.round(sim.gold), metalAfter: Math.round(sim.metal || 0), stoneAfter: Math.round(sim.stone),
      morale: Math.round(sim.morale), castleHp: Math.round(sim.castleHp),
      gearDrops: Math.max(0, (sim.vault || []).length - (state.vault || []).length),
      leveledUp: battleHeroIds.current.filter((id, i) => {
        const hero = state.heroes.find((item) => item.id === id);
        return hero && C.heroLevelForXp((hero.xp || 0) + (gainsHeroes[i] || 0)) > (preLevels.get(id) || hero.level);
      }).length,
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

  const announceAction = (message) => {
    if (actionNoticeTimer.current) clearTimeout(actionNoticeTimer.current);
    setActionNotice(message);
    actionNoticeTimer.current = setTimeout(() => setActionNotice(""), 1400);
  };

  const dismissActionPanels = () => {
    setTacticalOpen(false);
    setOpenHero(null);
    setOpenTower(null);
    setSelectedBuilding(null);
    setDebug(false);
    endSlow();
  };

  const openHeroCard = (i) => {
    setTacticalOpen(false);
    setOpenHero(i);
    triggerSlow();
  };

  const openTowerCard = (slot) => { setOpenTower(slot); triggerSlow(); };
  const closeCard = () => { setOpenHero(null); setOpenTower(null); endSlow(); };

  const canStartTacticalAction = (i) => {
    const engine = engineRef.current;
    return phaseRef.current === "combat" && !endedRef.current && !engine?.ended &&
      !pendingActionRef.current && !!engine?.heroes[i]?.alive;
  };

  const beginTacticalAction = (i, kind, execute) => {
    if (!canStartTacticalAction(i)) return false;
    pendingActionRef.current = { heroIndex: i, kind };
    setSelectionActive(false);
    dismissActionPanels();
    announceAction(`${kind.toUpperCase()} RESOLVING`);
    if (!execute()) {
      pendingActionRef.current = null;
      announceAction(`${kind.toUpperCase()} NOT AVAILABLE`);
      return false;
    }
    forceTick((t) => t + 1);
    return true;
  };

  const retreatHero = (i) => {
    if (beginTacticalAction(i, "retreat", () => engineRef.current?.retreatHero(i))) {
      setSelectedManualHero(i);
    }
  };

  const rallyHeroes = (i) => {
    if (beginTacticalAction(i, "rally", () => engineRef.current?.rallyHeroes(i))) {
      setSelectedManualHero(i);
    }
  };

  const useAbility = (i, abilityId, targetOrPoint = null) => {
    const started = beginTacticalAction(i, "ability", () => engineRef.current.useHeroAbility(i, abilityId, targetOrPoint));
    if (!started) setTargetFeedback("ABILITY NOT USED · target, range, or cooldown changed");
  };

  const castSpell = (i, spellId, targetOrPoint = null) => {
    const started = beginTacticalAction(i, "spell", () => engineRef.current.castMageSpell(i, spellId, targetOrPoint));
    if (!started) setTargetFeedback("SPELL NOT CAST · check valid targets, cooldown, and MP");
  };

  const beginAbilityTargeting = (heroIndex, abilityId) => {
    if (!canStartTacticalAction(heroIndex)) return;
    const ability = engineRef.current?.getHeroAbilityStatus(heroIndex)?.find((item) => item.id === abilityId);
    if (!ability?.targetMode) return;
    engineRef.current?.setTargetSelection(null);
    setActionTargeting({
      kind: "ability", heroIndex, id: abilityId, mode: ability.targetMode,
      name: ability.name, range: ability.range, radius: ability.radius, cooldown: ability.cooldown,
    });
    setAreaAim(null);
    setSelectionActive(true);
    dismissActionPanels();
    setTargetFeedback("");
  };

  const beginSpellTargeting = (heroIndex, spellId) => {
    if (!canStartTacticalAction(heroIndex)) return;
    const spell = engineRef.current?.getHeroSpellStatus(heroIndex)?.find((item) => item.id === spellId);
    if (!spell?.targetMode) return;
    engineRef.current?.setTargetSelection(null);
    setActionTargeting({
      kind: "spell", heroIndex, id: spellId, mode: spell.targetMode, name: spell.name,
      range: spell.range, radius: spell.researched ? 95 : spell.radius,
      cost: spell.cost, cooldown: spell.cooldown,
    });
    setAreaAim(null);
    setSelectionActive(true);
    dismissActionPanels();
    setTargetFeedback("");
  };

  const executeActionTarget = (targetOrPoint) => {
    const action = actionTargeting;
    if (!action || !canStartTacticalAction(action.heroIndex)) return false;
    const execute = () => action.kind === "ability"
      ? engineRef.current.useHeroAbility(action.heroIndex, action.id, targetOrPoint)
      : engineRef.current.castMageSpell(action.heroIndex, action.id, targetOrPoint);
    const started = beginTacticalAction(action.heroIndex, action.kind, execute);
    if (!started) {
      setSelectionActive(true);
      setActionTargeting(action);
      setTacticalOpen(false);
      setTargetFeedback("INVALID TARGET · choose a valid target or location");
    } else {
      setActionTargeting(null);
      setAreaAim(null);
    }
    return started;
  };

  const reviveHero = (i) => {
    if (engineRef.current?.reviveHero(i)) {
      dismissActionPanels();
      announceAction("HERO REVIVED");
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
      if (simRef.current?.heroes[i]) simRef.current.heroes[i].manual = true;
      if (state.heroes[i]) state.heroes[i].manual = true;
      setSelectedManualHero(i);
      engineRef.current.setSelectedHero(i);
      engineRef.current.setTargetSelection(null);
      setCommandMode("move");
      setTargetFeedback("");
      forceTick((t) => t + 1);
    }
  };

  const enableAuto = (i) => {
    if (!engineRef.current) return;
    if (engineRef.current.setHeroManual(i, false)) {
      if (simRef.current?.heroes[i]) simRef.current.heroes[i].manual = false;
      if (state.heroes[i]) state.heroes[i].manual = false;
      if (selectedManualHero === i) setSelectedManualHero(null);
      engineRef.current.setTargetSelection(null);
      setCommandMode("move");
      setTargetFeedback("");
      forceTick((t) => t + 1);
    }
  };

  const setBattleCommandMode = (mode) => {
    if (selectedManualHero == null || !canStartTacticalAction(selectedManualHero)) return;
    setActionTargeting(null);
    setAreaAim(null);
    dismissActionPanels();
    setSelectionActive(true);
    if (mode === "target") {
      engineRef.current?.setTargetSelection(selectedManualHero);
      setTargetFeedback("");
    } else {
      engineRef.current?.setTargetSelection(null);
    }
    setCommandMode(mode);
  };

  const cancelTargetSelection = () => {
    const pending = pendingActionRef.current;
    if (pending && engineRef.current?.cancelTacticalAction(pending.heroIndex)) return;
    engineRef.current?.setTargetSelection(null);
    setActionTargeting(null);
    setAreaAim(null);
    setCommandMode("move");
    setSelectionActive(false);
    setTargetFeedback("");
    announceAction("TARGETING CANCELED");
    dismissActionPanels();
  };

  const payToReviveFallenHeroes = () => {
    const engine = engineRef.current;
    const sim = simRef.current;
    const offer = engine?.getFallenHeroRevivalOffer?.();
    if (!offer || !sim || engine.ended) return;
    const result = engine.reviveFallenHeroes();
    if (!result) {
      toast.error(sim.gold < offer.cost ? "Not enough Treasury Gold to revive the fallen heroes" : "Revival is no longer available");
      return;
    }
    const revivedIds = new Set(result.heroIds);
    mutate((saved) => {
      saved.gold = sim.gold;
      for (const hero of saved.heroes || []) {
        if (!revivedIds.has(hero.id)) continue;
        const runtime = sim.heroes.find((item) => item.id === hero.id);
        if (runtime) { hero.hp = runtime.hp; hero.manual = false; }
      }
    });
    revivalDismissedRef.current = false;
    setShowRevivalOffer(false);
    announceAction("HEROES REVIVED");
    toast.success(`${result.heroIds.length} hero${result.heroIds.length === 1 ? "" : "es"} revived at ${C.RECOVERY.reviveHpPercent}% HP`);
    forceTick((tick) => tick + 1);
  };

  const activateBlockade = () => {
    const sim = simRef.current;
    if (!sim || !activateGuildBlockade(sim, Date.now())) {
      toast.error("Blockade unavailable — check Guild, barricades, cooldown, and Treasury supplies");
      return;
    }
    mutate((saved) => {
      saved.gold = sim.gold;
      saved.stone = sim.stone;
      saved.guildBlockadeLevel = sim.guildBlockadeLevel;
      saved.guildBlockadeActiveUntil = sim.guildBlockadeActiveUntil;
      saved.guildBlockadeCooldownUntil = sim.guildBlockadeCooldownUntil;
    });
    dismissActionPanels();
    announceAction("BLOCKADE ACTIVATED");
    setBlockadeNow(Date.now());
    toast.success("Universal blockade active · 8 seconds");
  };

  const selectRangedTarget = (target) => {
    if (selectedManualHero == null || !engineRef.current) return;
    if (!beginTacticalAction(selectedManualHero, "attack", () => engineRef.current.commandHeroAttack(selectedManualHero, target?.enemy))) {
      engineRef.current.setTargetSelection(selectedManualHero);
      setCommandMode("target");
      setSelectionActive(true);
      setTargetFeedback("INVALID TARGET · choose another target or cancel");
      return;
    }
    if (state.heroes[selectedManualHero]) state.heroes[selectedManualHero].manual = true;
    engineRef.current.setSelectedHero(selectedManualHero);
    engineRef.current.setTargetSelection(null);
    setCommandMode("move");
    setSelectionActive(false);
    setTargetFeedback(`TARGET SET · ${target.name} · ${target.hp}/${target.maxHp} HP`);
    forceTick((t) => t + 1);
  };

  const selectActionTarget = (target) => {
    if (!target?.enemy || !actionTargeting) return;
    executeActionTarget(target);
  };

  const changeActiveHero = (index) => {
    if (pendingActionRef.current) return;
    if (actionTargeting || selectionActive) {
      engineRef.current?.setTargetSelection(null);
      setActionTargeting(null);
      setAreaAim(null);
      setSelectionActive(false);
      if (commandMode === "target") setCommandMode("move");
      setTargetFeedback("");
      announceAction("TARGETING CANCELED · HERO CHANGED");
      dismissActionPanels();
    } else {
      setTargetFeedback("");
    }
    setSelectedManualHero(index);
    engineRef.current?.setSelectedHero(index);
    forceTick((t) => t + 1);
  };

  const closeTacticalMenu = () => {
    if (commandMode === "target" || actionTargeting) cancelTargetSelection();
    setTacticalOpen(false);
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
    if (phaseRef.current !== "combat" || !engineRef.current || engineRef.current.ended || endedRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Convert the phone's CSS pixels back into the engine's 420x760 logical space.
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    if (actionTargeting) {
      if (actionTargeting.mode === "area") {
        const preview = actionTargeting.kind === "ability"
          ? engineRef.current.getHeroAbilityAreaPreview(actionTargeting.heroIndex, actionTargeting.id, x, y)
          : engineRef.current.getMageSpellAreaPreview(actionTargeting.heroIndex, actionTargeting.id, x, y);
        if (!preview.valid) {
          setTargetFeedback(`INVALID AREA · ${preview.targets.length} eligible targets · RANGE ${actionTargeting.range}`);
          return;
        }
        executeActionTarget({ x, y });
        return;
      }
      const target = actionTargeting.kind === "ability"
        ? engineRef.current.getHeroAbilityTargetAt(actionTargeting.heroIndex, actionTargeting.id, x, y)
        : engineRef.current.getMageSpellTargetAt(actionTargeting.heroIndex, actionTargeting.id, x, y);
      if (!target) {
        setTargetFeedback(`INVALID TARGET · choose an eligible target within ${actionTargeting.range}`);
        return;
      }
      executeActionTarget(target);
      return;
    }

    const buildingId = engineRef.current.getBuildingAt?.(x, y);
    if (buildingId) {
      setSelectedBuilding(buildingId);
      setOpenHero(null);
      setOpenTower(null);
      return;
    }
    if (selectedBuilding) setSelectedBuilding(null);

    const heroIndex = selectedManualHero;
    if (heroIndex == null || !canStartTacticalAction(heroIndex)) {
      setSelectionActive(false);
      return;
    }

    const rangedTarget = commandMode === "target"
      ? engineRef.current.getRangedTargetAt(heroIndex, x, y)
      : null;
    const accepted = commandMode === "target"
      ? engineRef.current.commandHeroAttackAt(heroIndex, x, y)
      : engineRef.current.commandHeroMoveTo(heroIndex, x, y);

    if (accepted) {
      pendingActionRef.current = { heroIndex, kind: commandMode === "target" ? "attack" : "move" };
      if (state.heroes[heroIndex]) state.heroes[heroIndex].manual = true;
      setSelectedManualHero(heroIndex);
      engineRef.current.setSelectedHero(heroIndex);
      if (commandMode === "target") {
        pendingActionRef.current = { heroIndex, kind: "attack" };
        dismissActionPanels();
        announceAction("ATTACK RESOLVING");
        engineRef.current.setTargetSelection(null);
        setCommandMode("move");
        setTargetFeedback(rangedTarget ? `TARGET SET · ${rangedTarget.name} · ${rangedTarget.hp}/${rangedTarget.maxHp} HP` : "TARGET SET");
      } else {
        dismissActionPanels();
        announceAction("MOVE COMMAND SENT");
      }
      setSelectionActive(false);
      forceTick((t) => t + 1);
    } else {
      if (commandMode === "target") {
        engineRef.current.setTargetSelection(heroIndex);
        setSelectionActive(true);
        setTargetFeedback("INVALID TARGET · tap a valid enemy or cancel");
      } else {
        setSelectionActive(false);
        setTargetFeedback("DESTINATION NOT AVAILABLE");
        announceAction("DESTINATION NOT AVAILABLE");
      }
    }
  };

  const handleBattlefieldPointerMove = (e) => {
    if (!actionTargeting || actionTargeting.mode !== "area" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const preview = actionTargeting.kind === "ability"
      ? engineRef.current?.getHeroAbilityAreaPreview(actionTargeting.heroIndex, actionTargeting.id, x, y)
      : engineRef.current?.getMageSpellAreaPreview(actionTargeting.heroIndex, actionTargeting.id, x, y);
    setAreaAim({ x, y, valid: !!preview?.valid, targets: preview?.targets?.length || 0 });
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
  if (hasClasslessHeroes) return <div className="h-full flex items-center justify-center p-6 text-center font-mono-g text-yellow-300">Classless heroes are not enabled in live battle yet.</div>;
  const sim = simRef.current;
  const blockadeStatus = guildBlockadeStatus(sim || state, blockadeNow);
  const guild = sim?.buildings?.guild || state.buildings?.guild;
  const blockadeCanActivate = !!guild && guild.hp > 0 && guild.unlocked !== false &&
    blockadeStatus.unlocked && !blockadeStatus.active && blockadeStatus.cooldownMs <= 0 &&
    (sim?.barricades || state.barricades || []).some((b) => b?.hp > 0) &&
    (sim?.gold ?? state.gold) >= C.GUILD_BLOCKADE.activationGold &&
    (sim?.stone ?? state.stone) >= C.GUILD_BLOCKADE.activationStone;
  const revivalOffer = showRevivalOffer ? engineRef.current?.getFallenHeroRevivalOffer?.() : null;
  const rangedTargets = commandMode === "target"
    ? engineRef.current?.getRangedTargetStatus(selectedManualHero)
    : null;
  const actionTargets = actionTargeting?.mode === "enemy"
    ? actionTargeting.kind === "ability"
      ? engineRef.current?.getHeroAbilityTargets(actionTargeting.heroIndex, actionTargeting.id) || []
      : engineRef.current?.getMageSpellTargets(actionTargeting.heroIndex, actionTargeting.id) || []
    : [];

  return (
    <div className={`relative flex h-full w-full flex-col ${phase === "combat" ? "pb-[calc(8.5rem+env(safe-area-inset-bottom))]" : ""}`}>
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

      {/* Compact castle-building condition overview; detailed controls stay in preparation. */}
      {state.buildings && (
        <div className="px-3 py-1 flex items-center gap-2 overflow-x-auto border-b border-white/5" data-testid="battle-building-conditions">
          {[
            ["mine", "MINE", "#FFE600"],
            ["quarry", "QUARRY", "#00F3FF"],
            ["tavern", "TAVERN", "#FF007F"],
            ["shoppe", "SHOPPE", "#A855F7"],
            ["academy", "ACADEMY", "#39FF14"],
            ["guild", "GUILD", "#FF6600"],
            ["library", "LIBRARY", "#A855F7"],
            ["vault", "VAULT", "#00F3FF"],
          ].map(([id, label, color]) => {
            const b = state.buildings[id];
            if (!b) return null;
            const hp = Math.max(0, Number(b.hp) || 0);
            const maxHp = Math.max(1, Number(b.maxHp) || 1);
            const frac = hp / maxHp;
            const statusColor = frac <= 0 ? "#FF0055" : frac < 0.25 ? "#FF0055" : frac < 0.5 ? "#FF6600" : frac < 0.75 ? "#FFE600" : "#39FF14";
            return (
              <div key={id} className="min-w-[62px] rounded border border-white/10 bg-black/35 px-1.5 py-1" title={`${label}: ${Math.round(hp)}/${maxHp} HP`}>
                <div className="font-mono-g text-[7px] tracking-wide" style={{ color }}>{label}</div>
                <div className="h-1 rounded bg-white/10 mt-1 overflow-hidden"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, frac * 100))}%`, background: statusColor }} /></div>
              </div>
            );
          })}
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
          onPointerMove={handleBattlefieldPointerMove}
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

        {actionNotice && !selectionActive && !pendingActionRef.current && (
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 -translate-x-1/2 rounded border border-cyan-300/25 bg-[#090b12]/85 px-2 py-1 font-mono-g text-[8px] tracking-wide text-cyan-100"
            role="status" data-testid="combat-action-notice">
            {actionNotice}
          </div>
        )}

        {phase === "scout" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm" data-testid="scout-countdown">
            <div className="font-mono-g text-cyan-400 text-xs tracking-[0.35em] mb-2 animate-pulse-glow">ENEMY SCOUTS PROBING DEFENSES</div>
            <div className="font-display font-black text-8xl text-fuchsia-500 text-glow-magenta">{count}</div>
            <div className="font-mono-g text-slate-400 text-xs mt-2">Wave {waveNum.current} incoming...</div>
          </div>
        )}

        {phase === "combat" && revivalOffer && (
          <div className="absolute top-2 left-2 right-2 z-50 mx-auto max-w-sm rounded-2xl border border-cyan-300/50 bg-[#090b12]/95 p-3 shadow-[0_0_24px_rgba(0,243,255,0.18)]" role="dialog" aria-modal="false" aria-labelledby="battle-revival-title" data-testid="battle-revival-offer">
            <div className="flex items-start gap-2">
              <Heart size={17} className="mt-0.5 shrink-0 text-rose-400" />
              <div className="min-w-0 flex-1">
                <h2 id="battle-revival-title" className="font-display text-sm font-black text-cyan-200">SQUAD CRITICAL</h2>
                <p className="mt-1 font-mono-g text-[9px] text-slate-300">
                  One hero remains. Revive {revivalOffer.heroIds.length} fallen hero{revivalOffer.heroIds.length === 1 ? "" : "es"} at {C.RECOVERY.reviveHpPercent}% HP.
                </p>
                <p className="mt-1 font-mono-g text-[9px] text-yellow-200">
                  COST {revivalOffer.cost}G · TREASURY {Math.floor(sim?.gold || 0)}G
                </p>
              </div>
              <button type="button" className="min-h-11 min-w-11 rounded border border-white/20 text-slate-300" aria-label="Dismiss revival offer"
                onClick={() => { revivalDismissedRef.current = true; setShowRevivalOffer(false); }} data-testid="dismiss-battle-revival">
                <X size={14} className="mx-auto" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NeonButton color="green" className="!min-h-11 !py-2 !text-[9px]"
                disabled={(sim?.gold || 0) < revivalOffer.cost}
                onClick={payToReviveFallenHeroes} data-testid="pay-revive-fallen">
                REVIVE · {revivalOffer.cost}G
              </NeonButton>
              <button type="button" disabled className="min-h-11 rounded border border-white/10 bg-white/5 px-2 font-mono-g text-[8px] text-slate-500 disabled:opacity-70"
                data-testid="ad-revive-unavailable">
                AD REVIVE UNAVAILABLE
              </button>
            </div>
            <p className="mt-1 text-center font-mono-g text-[8px] text-slate-500">Rewarded-ad provider does not verify completion in this build.</p>
          </div>
        )}

        {selectedBuilding && (() => {
          const b = sim?.buildings?.[selectedBuilding] || state.buildings?.[selectedBuilding];
          if (!b) return null;
          const names = { mine: "Mine", quarry: "Quarry", tavern: "Tavern", shoppe: "Shoppe", academy: "Academy", guild: "Guild", library: "Library", vault: "Vault" };
          const colors = { mine: "#FFE600", quarry: "#00F3FF", tavern: "#FF007F", shoppe: "#A855F7", academy: "#39FF14", guild: "#FF6600", library: "#B66CFF", vault: "#00F3FF" };
          const color = colors[selectedBuilding] || "#00F3FF";
          const level = Math.max(1, b.level || 1);
          const locked = b.unlocked === false;
          return (
            <div className="absolute z-30 top-2 left-2 right-2 max-w-[260px] rounded-xl border bg-[#090b12]/95 backdrop-blur-md p-3 shadow-xl" style={{ borderColor: color + "88" }} data-testid="battlefield-building-panel">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display font-black text-sm" style={{ color }}>{names[selectedBuilding]?.toUpperCase()} · L{level}</div>
                  <div className="font-mono-g text-[9px] text-slate-300 mt-1">{Math.round(b.hp || 0)} / {Math.round(b.maxHp || 1000)} HP · {b.activity || "Idle"}</div>
                </div>
                <button className="font-mono-g text-[10px] text-slate-300 px-2 py-1 border border-white/20 rounded" onClick={() => setSelectedBuilding(null)} data-testid="close-building-panel">CLOSE</button>
              </div>
              <div className="h-1.5 rounded bg-white/10 mt-2 overflow-hidden"><div className="h-full" style={{ width: Math.max(0, Math.min(100, (b.hp || 0) / Math.max(1, b.maxHp || 1000) * 100)) + "%", background: color }} /></div>
              {locked ? (
                <div className="font-mono-g text-[9px] text-slate-400 mt-2">Locked building · defensive turret remains active</div>
              ) : (
                <div className="font-mono-g text-[9px] text-slate-400 mt-2">Manage repairs, upgrades, and turret ammunition in Preparation.</div>
              )}
            </div>
          );
        })()}

        {/* Target and movement prompts sit above the persistent command dock. */}
        {actionTargeting?.mode === "area" && areaAim && (() => {
          const canvasRect = canvasRef.current?.getBoundingClientRect();
          const parentRect = canvasRef.current?.parentElement?.getBoundingClientRect();
          if (!canvasRect || !parentRect || !canvasRect.width || !canvasRect.height) return null;
          const radius = Math.max(8, (actionTargeting.radius || 70) * canvasRect.width / LAYOUT.W);
          return (
            <div
              className="pointer-events-none absolute z-20 rounded-full border-2"
              style={{
                left: canvasRect.left - parentRect.left + areaAim.x * canvasRect.width / LAYOUT.W - radius,
                top: canvasRect.top - parentRect.top + areaAim.y * canvasRect.height / LAYOUT.H - radius,
                width: radius * 2,
                height: radius * 2,
                borderColor: areaAim.valid ? "#39FF14" : "#FF0055",
                background: areaAim.valid ? "rgba(57,255,20,0.08)" : "rgba(255,0,85,0.06)",
              }}
              data-testid="combat-area-preview"
            />
          );
        })()}

        {(actionTargeting || (selectionActive && commandMode === "target") ) && (() => {
          const canvasRect = canvasRef.current?.getBoundingClientRect();
          const parentRect = canvasRef.current?.parentElement?.getBoundingClientRect();
          const targets = actionTargeting ? actionTargets : rangedTargets?.targets || [];
          if (!canvasRect || !parentRect || !canvasRect.width || !canvasRect.height) return null;
          return targets.map((target, index) => {
            if (!target.enemy || !Number.isFinite(target.enemy.x) || !Number.isFinite(target.enemy.y)) return null;
            const left = canvasRect.left - parentRect.left + target.enemy.x * canvasRect.width / LAYOUT.W;
            const top = canvasRect.top - parentRect.top + target.enemy.y * canvasRect.height / LAYOUT.H;
            return (
              <div key={`${target.enemy.id || target.type}-${index}`}
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-green-300 bg-green-300/10 shadow-[0_0_12px_rgba(57,255,20,0.55)]"
                style={{ left, top, width: 34, height: 34 }}
                data-testid="battlefield-valid-target-marker" />
            );
          });
        })()}

        {!endedRef.current && (selectionActive || pendingActionRef.current) && (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-40 mx-auto max-w-[280px] rounded-xl border border-cyan-400/40 bg-[#090b12]/95 p-2 shadow-xl" data-testid="tactical-action-overlay">
            {actionTargeting ? (
              <>
                <div className="mb-1 text-center font-mono-g text-[9px] font-bold text-green-300">
                  {actionTargeting.mode === "area"
                    ? `CHOOSE ${actionTargeting.name?.toUpperCase() || "AREA"} · ${areaAim?.targets || 0} TARGETS · RANGE ${actionTargeting.range} · RADIUS ${actionTargeting.radius}`
                    : `SELECT ${actionTargeting.name?.toUpperCase() || "TARGET"} · ${actionTargets.length} IN RANGE · RANGE ${actionTargeting.range}`}
                </div>
                <div className="mb-1 text-center font-mono-g text-[8px] text-slate-300">
                  {actionTargeting.cost != null ? `${actionTargeting.cost} MP · ` : ""}
                  {actionTargeting.cooldown != null ? `${actionTargeting.cooldown}s COOLDOWN` : ""}
                </div>
                {actionTargeting.mode === "enemy" && (
                  <div className="pointer-events-auto flex max-h-12 gap-1 overflow-x-auto">
                    {actionTargets.slice(0, 4).map((target) => (
                      <button key={`${target.type}-${target.name}-${target.distance}`} type="button"
                        onClick={() => selectActionTarget(target)}
                        className="min-h-10 shrink-0 rounded border border-green-400/25 bg-green-500/5 px-2 text-left font-mono-g text-[8px] text-slate-100"
                        data-testid={`ability-target-${target.type}`}>
                        {target.name} · {target.hp}/{target.maxHp} HP · {target.distance}
                      </button>
                    ))}
                    {!actionTargets.length && <div className="py-1 text-center font-mono-g text-[8px] text-slate-400">NO VALID TARGETS</div>}
                  </div>
                )}
                {actionTargeting.mode === "area" && (
                  <div className="py-1 text-center font-mono-g text-[8px] text-slate-300">
                    TAP A VALID LOCATION · {actionTargeting.radius || 70} AREA RADIUS
                  </div>
                )}
                {targetFeedback && <div className="py-1 text-center font-mono-g text-[8px] text-rose-200" role="status">{targetFeedback}</div>}
                <button type="button" onClick={cancelTargetSelection}
                  className="pointer-events-auto mt-1 min-h-10 w-full rounded border border-white/20 bg-white/5 font-mono-g text-[8px] text-slate-200"
                  data-testid="tactical-action-cancel">CANCEL</button>
              </>
            ) : selectionActive && commandMode === "target" ? (
              <>
                <div className="mb-1 text-center font-mono-g text-[9px] font-bold text-green-300">
                  SELECT TARGET · {rangedTargets?.targets.length || 0} IN RANGE
                </div>
                <div className="pointer-events-auto flex max-h-12 gap-1 overflow-x-auto">
                  {(rangedTargets?.targets || []).slice(0, 4).map((target) => (
                    <button key={`${target.type}-${target.name}-${target.distance}`} type="button"
                      onClick={() => selectRangedTarget(target)}
                      className="min-h-10 shrink-0 rounded border border-green-400/25 bg-green-500/5 px-2 text-left font-mono-g text-[8px] text-slate-100"
                      data-testid={`battle-target-${target.type}`}>
                      {target.name} · {target.hp}/{target.maxHp} HP · {target.distance}
                    </button>
                  ))}
                  {!rangedTargets?.targets.length && <div className="py-1 text-center font-mono-g text-[8px] text-slate-400">NO VALID TARGETS</div>}
                </div>
                {targetFeedback && <div className="py-1 text-center font-mono-g text-[8px] text-rose-200" role="status">{targetFeedback}</div>}
                <button type="button" onClick={cancelTargetSelection}
                  className="pointer-events-auto mt-1 min-h-10 w-full rounded border border-white/20 bg-white/5 font-mono-g text-[8px] text-slate-200"
                  data-testid="tactical-action-cancel">CANCEL</button>
              </>
            ) : selectionActive ? (
              <>
                <div className="mb-1 text-center font-mono-g text-[9px] text-cyan-200">MOVE MODE · TAP THE BATTLEFIELD</div>
                <button type="button" onClick={cancelTargetSelection}
                  className="pointer-events-auto min-h-10 w-full rounded border border-white/20 bg-white/5 font-mono-g text-[8px] text-slate-200"
                  data-testid="tactical-action-cancel">CANCEL</button>
              </>
            ) : (
              <div className="mb-1 text-center font-mono-g text-[9px] text-cyan-200">
                {pendingActionRef.current?.kind.toUpperCase()} RESOLVING
              </div>
            )}
          </div>
        )}

        <TacticalMenu
          visible={phase === "combat" && !endedRef.current}
          open={tacticalOpen}
          disabled={selectionActive || !!pendingActionRef.current}
          onOpen={() => setTacticalOpen(true)}
          onClose={closeTacticalMenu}
          heroes={state.heroes}
          selectedHero={selectedManualHero}
          commandMode={commandMode}
          onSelectHero={(i) => {
            changeActiveHero(i);
          }}
          switchDisabled={!!pendingActionRef.current}
          onManual={enableManual}
          onAuto={enableAuto}
          onCommandMode={setBattleCommandMode}
          gold={sim?.gold ?? state.gold}
          onRetreat={retreatHero}
          onRally={rallyHeroes}
          onRevive={reviveHero}
          onAbility={useAbility}
          onBeginAbilityTarget={beginAbilityTargeting}
          abilityStatus={hud?.heroAbilities?.[selectedManualHero] || []}
          onCastSpell={castSpell}
          onBeginSpellTarget={beginSpellTargeting}
          spellStatus={hud?.heroSpells?.[selectedManualHero] || []}
          targetSelection={rangedTargets}
          targetFeedback={targetFeedback}
          onSelectRangedTarget={selectRangedTarget}
          onCancelTarget={cancelTargetSelection}
          heroStatuses={hud?.heroes || []}
          onDetails={openHeroCard}
          opaque={hudOpaque}
          onToggleOpaque={toggleHudOpaque}
          blockadeStatus={blockadeStatus.unlocked ? blockadeStatus : null}
          blockadeCanActivate={blockadeCanActivate}
          blockadeCost={{ gold: C.GUILD_BLOCKADE.activationGold, stone: C.GUILD_BLOCKADE.activationStone }}
          onActivateBlockade={activateBlockade}
        />
      </div>

      {/* tower quick access */}
      <div className="px-2 py-1 flex gap-1.5 border-t border-white/10 overflow-x-auto no-scrollbar" data-testid="tower-rack">
        {state.towers.map((tw, slot) => tw ? (
          <button key={slot} onClick={() => openTowerCard(slot)} data-testid={`battle-tower-${slot}`}
            className="shrink-0 bracket rounded px-2 py-1 flex items-center gap-1"
            style={{ color: C.TOWERS[tw.type].color }}>
            <TowerIcon type={tw.type} size={13} />
            <span className="font-mono-g text-[9px] text-slate-300">L{tw.level}</span>
          </button>
        ) : null)}
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
