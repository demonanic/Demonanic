import { useState } from "react";
import { toast } from "sonner";
import { useGame } from "@/context/GameProvider";
import { NeonButton, SectionTitle, TopResourceHUD, StatBar } from "@/components/ui-kit";
import { HeroCard } from "@/components/cards";
import { Input } from "@/components/ui/input";
import { Home as HomeIcon, UserPlus, Trash2, Pencil, Check } from "lucide-react";
import * as C from "@/game/config";
import {
  heroDerived, allocateSp, buyPerk, recruitHero, swapHero, renameHero, retireHero,
} from "@/game/logic";

export default function Roster() {
  const { state, mutate, setScreen } = useGame();
  const [open, setOpen] = useState(null);      // {list, idx}
  const [editing, setEditing] = useState(null); // "list-idx"
  const [nameVal, setNameVal] = useState("");
  if (!state) return null;
  const owned = state.heroes.length + (state.bench?.length || 0);
  const act = (fn, ok, fail) => mutate((s) => { if (!fn(s)) toast.error(fail || "Invalid"); else if (ok) toast.success(ok); });
  const hero = open ? (open.list === "squad" ? state.heroes[open.idx] : state.bench[open.idx]) : null;

  const startEdit = (key, cur) => { setEditing(key); setNameVal(cur); };
  const commitEdit = (list, idx) => { act((s) => renameHero(s, list, idx, nameVal), "Renamed"); setEditing(null); };

  const Row = ({ h, list, idx }) => {
    const cls = C.HERO_CLASSES[h.cls];
    const d = heroDerived(h);
    const key = `${list}-${idx}`;
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
            <span className="font-mono-g text-[9px] text-slate-500">Swap into squad:</span>
            {state.heroes.map((_, si) => (
              <button key={si} onClick={() => act((s) => swapHero(s, idx, si), "Swapped")} data-testid={`roster-swap-${idx}-${si}`}
                className="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-mono-g text-[10px]">S{si + 1}</button>
            ))}
            <NeonButton color="red" className="!px-2 !py-1 !text-[9px] ml-auto" onClick={() => act((s) => retireHero(s, idx), "Retired")} data-testid={`roster-retire-${idx}`}><Trash2 size={11} /></NeonButton>
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

      <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
        <div>
          <SectionTitle color="cyan">Active Squad</SectionTitle>
          <div className="grid gap-2.5 mt-2" data-testid="roster-squad">
            {state.heroes.map((h, i) => <Row key={h.id} h={h} list="squad" idx={i} />)}
          </div>
        </div>

        {state.bench && state.bench.length > 0 && (
          <div>
            <SectionTitle color="yellow">Bench</SectionTitle>
            <div className="grid gap-2.5 mt-2" data-testid="roster-bench">
              {state.bench.map((h, i) => <Row key={h.id} h={h} list="bench" idx={i} />)}
            </div>
          </div>
        )}

        <div className="glass-card rounded-xl p-3" data-testid="roster-recruit">
          <SectionTitle color="magenta">Recruit New Hero</SectionTitle>
          <p className="font-mono-g text-[10px] text-slate-400 mt-1 mb-2">Cost {C.recruitCost(owned)}g — always available (no Castle Power gate).</p>
          <div className="grid grid-cols-2 gap-1.5">
            {C.HERO_ORDER.map((cls) => {
              const c = C.HERO_CLASSES[cls];
              return (
                <button key={cls} data-testid={`roster-recruit-${cls}`} onClick={() => act((s) => recruitHero(s, cls), `${c.name} recruited`)}
                  className="neon-btn flex items-center gap-2 p-2 rounded-lg border bg-black/40" style={{ borderColor: c.color + "55" }}>
                  <div className="w-6 h-7 rounded" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                  <div className="text-left">
                    <div className="font-mono-g text-xs font-bold" style={{ color: c.color }}>{c.name}</div>
                    <div className="font-mono-g text-[9px] text-slate-400 flex items-center gap-1"><UserPlus size={9} />{C.recruitCost(owned)}g</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {hero && (
        <HeroCard hero={hero} editable
          onAlloc={(st) => mutate((s) => allocateSp(open.list === "squad" ? s.heroes[open.idx] : s.bench[open.idx], st))}
          onPerk={(p) => mutate((s) => { if (!buyPerk(open.list === "squad" ? s.heroes[open.idx] : s.bench[open.idx], p)) toast.error("Not enough AP"); })}
          onConfig={(cfg) => mutate((s) => { const t = open.list === "squad" ? s.heroes[open.idx] : s.bench[open.idx]; t.attackConfig = cfg; })}
          onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
