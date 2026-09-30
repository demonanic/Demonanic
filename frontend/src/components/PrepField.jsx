import { useState } from "react";
import { slotPositions, LAYOUT } from "@/game/engine";
import { NeonButton, StatBar } from "@/components/ui-kit";
import { slotCap, towerDerived, canAfford } from "@/game/logic";
import { Plus, Wrench, Trash2 } from "lucide-react";
import * as C from "@/game/config";

const SLOT_POS = slotPositions();
const { W, H, WALL_Y, GATE_Y, HERO_Y } = LAYOUT;
const pctX = (x) => `${(x / W) * 100}%`;
const pctY = (y) => `${(y / H) * 100}%`;

export default function PrepField({ state, handlers }) {
  const [sel, setSel] = useState(null); // {kind:'slot'|'tower'|'barricade', idx}
  const cap = slotCap(state);
  const n = state.heroes.length || 1;

  const close = () => setSel(null);

  return (
    <div className="flex flex-col items-center">
      <div className="relative rounded-xl overflow-hidden border border-cyan-500/20 mx-auto"
        style={{ aspectRatio: `${W}/${H}`, width: "min(340px, 78vw)", background: "#12131A" }}
        data-testid="prep-battlefield">
        {/* grid */}
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "10% 5.5%" }} />
        {/* walls */}
        <div className="absolute left-0 right-0" style={{ top: pctY(WALL_Y), height: 2, background: "#FFE600", boxShadow: "0 0 10px #FFE600" }} />
        <div className="absolute left-0 right-0" style={{ top: pctY(GATE_Y), height: 2, background: "#FF2A5F", boxShadow: "0 0 10px #FF2A5F" }} />
        {/* castle keep */}
        <div className="absolute" style={{ left: "50%", top: "96%", transform: "translate(-50%,-50%)", width: "34%", height: "4%", border: "2px solid #FF2A5F", boxShadow: "0 0 12px #FF2A5F" }} />
        <div className="absolute font-mono-g text-[8px] text-yellow-300/70" style={{ left: 4, top: `calc(${pctY(WALL_Y)} - 12px)` }}>OUTER WALL</div>
        <div className="absolute font-mono-g text-[8px] text-rose-400/70" style={{ left: 4, top: `calc(${pctY(GATE_Y)} - 12px)` }}>GATE</div>

        {/* barricade lanes at wall line */}
        {state.barricades.map((b, pos) => {
          const x = (W / 5) * (pos + 0.5);
          const on = b.maxHp > 0;
          return (
            <button key={pos} data-testid={`field-barricade-${pos}`} onClick={() => setSel({ kind: "barricade", idx: pos })}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded"
              style={{ left: pctX(x), top: pctY(WALL_Y), width: "15%", height: "2.6%",
                backgroundImage: on ? "repeating-linear-gradient(45deg,#FFE600 0,#FFE600 5px,#12131A 5px,#12131A 10px)" : "none",
                border: `1px solid ${on ? "#FFE600" : "rgba(255,230,0,0.35)"}`,
                opacity: on ? 0.5 + 0.5 * (b.hp / b.maxHp) : 0.4,
                outline: sel?.kind === "barricade" && sel.idx === pos ? "2px solid #00F3FF" : "none" }} />
          );
        })}

        {/* tower slots */}
        {SLOT_POS.map((p, slot) => {
          const unlocked = slot < cap;
          const tw = state.towers[slot];
          const color = tw ? C.TOWERS[tw.type].color : unlocked ? "#00F3FF" : "#475569";
          return (
            <button key={slot} data-testid={`field-slot-${slot}`} disabled={!unlocked}
              onClick={() => setSel({ kind: tw ? "tower" : "slot", idx: slot })}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded flex items-center justify-center bracket"
              style={{ left: pctX(p.x), top: pctY(p.y), width: "17%", height: "9%",
                borderColor: color, opacity: unlocked ? 1 : 0.4,
                outline: sel && sel.idx === slot && sel.kind !== "barricade" ? "2px solid #00F3FF" : "none" }}>
              {tw ? (
                <div className="w-3.5 h-3.5 rounded" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
              ) : unlocked ? <Plus size={14} className="text-cyan-300" /> : <span className="font-mono-g text-[7px] text-slate-500">{C.SLOT_THRESHOLDS[slot]}CP</span>}
            </button>
          );
        })}

        {/* hero markers */}
        {state.heroes.map((h, i) => {
          const c = C.HERO_CLASSES[h.cls];
          return (
            <div key={h.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded"
              style={{ left: pctX(W * ((i + 0.5) / n)), top: pctY(HERO_Y), width: "5%", height: "5%", background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
          );
        })}
      </div>

      {/* contextual action bar */}
      <div className="w-full max-w-md mt-2 min-h-[64px]">
        {!sel && <p className="font-mono-g text-[11px] text-slate-500 text-center py-3">Tap a tower location, a tower, or a barricade lane on the field to configure it.</p>}

        {sel?.kind === "slot" && (
          <div className="glass-card rounded-xl p-2.5" data-testid="build-menu">
            <div className="font-mono-g text-[10px] text-cyan-400 mb-1.5">Build tower at location {sel.idx + 1}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {C.TOWER_ORDER.map((tp) => {
                const t = C.TOWERS[tp];
                const ok = canAfford(state, t.construction);
                return (
                  <button key={tp} disabled={!ok} data-testid={`field-build-${tp}-${sel.idx}`}
                    onClick={() => { handlers.build(sel.idx, tp); close(); }}
                    className="text-left p-2 rounded-lg border bg-black/40 disabled:opacity-30" style={{ borderColor: t.color + "66" }}>
                    <div className="font-mono-g text-xs font-bold" style={{ color: t.color }}>{t.name}</div>
                    <div className="font-mono-g text-[9px] text-slate-400">{t.construction.gold}g {t.construction.stone}s {t.construction.food}f</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {sel?.kind === "tower" && state.towers[sel.idx] && (() => {
          const tw = state.towers[sel.idx]; const t = C.TOWERS[tw.type]; const d = towerDerived(tw);
          return (
            <div className="glass-card rounded-xl p-2.5 flex items-center gap-3" data-testid="tower-actions" style={{ borderLeft: `3px solid ${t.color}` }}>
              <div className="flex-1">
                <div className="font-mono-g text-xs font-bold" style={{ color: t.color }}>{t.name} L{tw.level} {tw.pending > 0 && <span className="text-yellow-300 animate-pulse-glow">⬆{tw.pending}</span>}</div>
                <StatBar frac={tw.hp / d.maxHp} color={t.color} height={4} />
                <div className="font-mono-g text-[9px] text-slate-500 mt-0.5">{Math.round(tw.hp)}/{d.maxHp} HP</div>
              </div>
              <NeonButton color="cyan" className="!px-2 !py-1 !text-[9px]" onClick={() => handlers.openCard(sel.idx)} data-testid={`field-tower-card-${sel.idx}`}>Card</NeonButton>
              <NeonButton color="green" className="!px-2 !py-1 !text-[9px]" onClick={() => handlers.repairTower(sel.idx)} data-testid={`field-repair-tower-${sel.idx}`}><Wrench size={11} /></NeonButton>
              <NeonButton color="red" className="!px-2 !py-1 !text-[9px]" onClick={() => { handlers.dismantle(sel.idx); close(); }} data-testid={`field-dismantle-${sel.idx}`}><Trash2 size={11} /></NeonButton>
            </div>
          );
        })()}

        {sel?.kind === "barricade" && (() => {
          const b = state.barricades[sel.idx];
          return (
            <div className="glass-card rounded-xl p-2.5" data-testid="barricade-actions">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono-g text-xs text-yellow-300">Barricade lane {sel.idx + 1}</span>
                <span className="font-mono-g text-[10px] text-slate-400">{Math.round(b.hp)}/{Math.round(b.maxHp)} HP</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[25, 50, 100].map((g) => (
                  <NeonButton key={g} color="yellow" className="!px-2 !py-1 !text-[10px]" onClick={() => handlers.buyBarricade(sel.idx, g)} data-testid={`field-barricade-buy-${sel.idx}-${g}`}>+{g}g</NeonButton>
                ))}
                {b.hp < b.maxHp && <NeonButton color="green" className="!px-2 !py-1 !text-[10px]" onClick={() => handlers.repairBarricade(sel.idx)} data-testid={`field-barricade-repair-${sel.idx}`}><Wrench size={11} /></NeonButton>}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
