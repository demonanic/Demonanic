import { useState } from "react";
import { toast } from "sonner";
import { useGame } from "../context/GameProvider";
import { NeonButton, SectionTitle, TopResourceHUD, StatBar } from "../components/ui-kit";
import { HeroCard } from "../components/cards";
import { Input } from "../components/ui/input";
import { Home as HomeIcon, Trash2, Pencil, Check } from "lucide-react";
import * as C from "../game/config";
import {
  heroDerived, allocateSp, buyPerk, swapHero, renameHero, retireHero,
} from "../game/logic";
import { allocateClasslessStat, purchaseClasslessNode } from "../game/classlessProgression";
import ClasslessPerkTree from "../components/ClasslessPerkTree";
import ClasslessHeroAvatar from "../components/ClasslessHeroAvatar";
import { classlessMaxHp } from "../game/classlessCombatEffects";

export default function Roster() {
  const { state, mutate, setScreen } = useGame();
  const [open, setOpen] = useState(null);      // {list, idx}
  const [progressionHeroId, setProgressionHeroId] = useState(null);
  const [editing, setEditing] = useState(null); // "list-idx"
  const [nameVal, setNameVal] = useState("");
  if (!state) return null;
  const owned = state.heroes.length + (state.bench?.length || 0) + (state.academyHeroes?.length || 0);
  const act = (fn, ok, fail) => mutate((s) => { if (!fn(s)) toast.error(fail || "Invalid"); else if (ok) toast.success(ok); });
  const hero = open ? (open.list === "squad" ? state.heroes[open.idx] : state.bench[open.idx]) : null;
  const progressionHero = [...(state.heroes || []), ...(state.bench || [])]
    .find((item) => !item.cls && item.combat && item.identity?.id === progressionHeroId) || null;

  const purchaseClasslessPerk = (nodeId) => mutate((s) => {
    const target = [...(s.heroes || []), ...(s.bench || [])]
      .find((item) => !item.cls && item.combat && item.identity?.id === progressionHeroId);
    const result = purchaseClasslessNode(target, nodeId);
    if (!result.ok) {
      toast.error(`Perk purchase rejected: ${result.reason.replaceAll("_", " ")}`);
      return;
    }
    target.progression = result.progression;
    toast.success(`${nodeId} purchased`);
  });
  const allocateClasslessPoint = (stat) => mutate((s) => {
    const target = [...(s.heroes || []), ...(s.bench || [])]
      .find((item) => !item.cls && item.combat && item.identity?.id === progressionHeroId);
    const result = allocateClasslessStat(target, stat);
    if (!result.ok) return;
    const index = (s.heroes || []).findIndex((item) => item.identity?.id === progressionHeroId);
    if (index >= 0) s.heroes[index] = result.hero;
    else {
      const benchIndex = (s.bench || []).findIndex((item) => item.identity?.id === progressionHeroId);
      if (benchIndex >= 0) s.bench[benchIndex] = result.hero;
    }
  });

  const startEdit = (key, cur) => { setEditing(key); setNameVal(cur); };
  const commitEdit = (list, idx) => { act((s) => renameHero(s, list, idx, nameVal), "Renamed"); setEditing(null); };

  const Row = ({ h, list, idx }) => {
    if (!h.cls && h.combat) {
      const maxHp = classlessMaxHp(h);
      return (
      <div className="glass-card rounded-xl p-3" data-testid={`roster-${list}-${idx}`}>
        <div className="flex items-center gap-3">
          <ClasslessHeroAvatar className="h-12 w-10 rounded border border-cyan-400/30 bg-black/30" label={`${h.identity?.name || "Hero"} classless sprite`} />
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-sm text-cyan-200">{h.identity?.name || "Hero"}</div>
            <div className="font-mono-g text-[10px] text-slate-400">Classless · L{h.progression?.level || 1} · {Math.round(h.combat.hp)}/{maxHp} HP</div>
            <div className="font-mono-g text-[9px] text-slate-500">Appearance: {h.appearance?.id || "Unselected"}</div>
            <div className="font-mono-g text-[9px] text-slate-500">ATK{h.combat.stats?.attack} DEF{h.combat.stats?.defense} AGL{h.combat.stats?.agility} INT{h.combat.stats?.intelligence}</div>
            <StatBar frac={h.combat.hp / maxHp} color="#22D3EE" height={3} />
          </div>
        </div>
        <button type="button" onClick={() => setProgressionHeroId(h.identity.id)}
          className="mt-3 min-h-10 w-full rounded border border-cyan-400/30 bg-cyan-500/5 font-mono-g text-[10px] text-cyan-100"
          data-testid={`roster-classless-progression-${h.identity.id}`}>
          UNIVERSAL PERKS · {h.progression?.ap || 0} AP
        </button>
      </div>
      );
    }
    const cls = C.HERO_CLASSES[h.cls];
    const d = heroDerived(h);
    const key = `${list}-${idx}`;
    const busyResearching = state.libraryResearch?.mageId === h.id;
    return (
      <div className="glass-card rounded-xl p-3" style={{ borderLeft: `3px solid ${cls.color}` }} data-testid={`roster-${list}-${idx}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => setOpen({ list, idx })} className="w-10 h-12 rounded shrink-0" style={{ background: cls.color, boxShadow: `0 0 12px ${cls.color}` }} data-testid={`roster-card-${list}-${idx}`} />
          <div className="flex-1 min-w-0">
            {editing === key ? (
              <div className="flex items-center gap-1.5">
                <Input value={nameVal} onChange={(e) => setNameVal(e.target.value)} className="h-7 bg-black/40 border-cyan-500/30 text-slate-100 font-mono-g text-xs" data-testid={`roster-name-input-${list}-${idx}`} />
                <button onClick={() => commitEdit(list, idx)} data-testid={`roster-name-save-${list}-${idx}`} className="text-green-400"><Check size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-sm" style={{ color: cls.color }}>{h.name}</span>
                <span className="font-mono-g text-[10px] text-slate-500">{cls.name} L{h.level}</span>
                <button onClick={() => startEdit(key, h.name)} data-testid={`roster-rename-${list}-${idx}`} className="text-slate-500 hover:text-cyan-300"><Pencil size={11} /></button>
                {(h.sp > 0 || h.ap > 0) && <span className="font-mono-g text-[9px] text-fuchsia-400 animate-pulse-glow">SP{h.sp} AP{h.ap}</span>}
              </div>
            )}
            <div className="font-mono-g text-[10px] text-slate-400 mt-0.5">{h.attackConfig}</div>
            <div className="font-mono-g text-[9px] text-slate-500">ATK{h.stats.attack} DEF{h.stats.defense} AGL{h.stats.agility} INT{h.stats.intelligence} · {h.perks.length} perks</div>
            <StatBar frac={h.hp / d.maxHp} color={cls.color} height={3} />
          </div>
        </div>
        {list === "bench" && (
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {busyResearching ? (
              <span className="rounded border border-fuchsia-400/40 bg-fuchsia-400/10 px-2 py-1 font-mono-g text-[10px] text-fuchsia-200" data-testid={`roster-busy-${idx}`}>BUSY RESEARCHING · unavailable until complete</span>
            ) : (
              <>
                {state.heroes.length < C.HERO_ROSTER.maximumSquad && (
                  <NeonButton color="green" className="!px-2 !py-1 !text-[10px]" onClick={() => act((s) => {
                    if (!s.bench?.[idx] || s.heroes.length >= C.HERO_ROSTER.maximumSquad || s.libraryResearch?.mageId === s.bench[idx].id) return false;
                    s.heroes.push(s.bench.splice(idx, 1)[0]);
                    return true;
                  }, "Added to squad", "No open squad slot available or hero is busy researching")} data-testid={`roster-add-${idx}`}>Add to Squad</NeonButton>
                )}
                {state.heroes.length > 0 && <span className="font-mono-g text-[9px] text-slate-500">Or replace a squad member:</span>}
                {state.heroes.map((_, si) => (
                  <button key={si} onClick={() => act((s) => {
                    if (s.libraryResearch?.mageId === s.bench?.[idx]?.id) return false;
                    return swapHero(s, idx, si);
                  }, "Swapped", "This hero is busy researching")} data-testid={`roster-swap-${idx}-${si}`}
                    aria-label={`Replace squad slot ${si + 1} with ${h.name}`}
                    className="px-2 h-6 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-mono-g text-[10px]">Replace S{si + 1}</button>
                ))}
                <NeonButton color="red" className="!px-2 !py-1 !text-[9px] ml-auto" onClick={() => act((s) => {
                  if (s.libraryResearch?.mageId === s.bench?.[idx]?.id) return false;
                  return retireHero(s, idx);
                }, "Retired", "A researching hero cannot be retired")} data-testid={`roster-retire-${idx}`}><Trash2 size={11} /></NeonButton>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col">
      <header className="p-3 flex items-center gap-2 border-b border-white/10">
        <NeonButton color="cyan" onClick={() => setScreen("home")} data-testid="roster-back"><HomeIcon size={14} /></NeonButton>
        <TopResourceHUD state={state} compact />
      </header>

      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">\n        <div>
          <SectionTitle color="cyan">Active Squad</SectionTitle>
          <div className="grid gap-2.5 mt-2" data-testid="roster-squad">
            {state.heroes.map((h, i) => <Row key={h.id || h.identity?.id || i} h={h} list="squad" idx={i} />)}
          </div>
        </div>

        {state.bench && state.bench.length > 0 && (
          <div>
            <SectionTitle color="yellow">Bench</SectionTitle>
            <div className="grid gap-2.5 mt-2" data-testid="roster-bench">
              {state.bench.map((h, i) => <Row key={h.id || h.identity?.id || i} h={h} list="bench" idx={i} />)}
            </div>
          </div>
        )}


      </div>

      {hero && !(!hero.cls && hero.combat) && (
        <HeroCard hero={hero} editable
          onAlloc={(st) => mutate((s) => allocateSp(open.list === "squad" ? s.heroes[open.idx] : s.bench[open.idx], st))}
          onPerk={(p) => mutate((s) => { if (!buyPerk(open.list === "squad" ? s.heroes[open.idx] : s.bench[open.idx], p)) toast.error("Not enough AP"); })}
          onConfig={(cfg) => mutate((s) => { const t = open.list === "squad" ? s.heroes[open.idx] : s.bench[open.idx]; t.attackConfig = cfg; })}
          onClose={() => setOpen(null)} />
      )}
      {progressionHero && <ClasslessPerkTree hero={progressionHero} onPurchase={purchaseClasslessPerk}
        onAllocate={allocateClasslessPoint} onClose={() => setProgressionHeroId(null)} />}
    </div>
  );
}
