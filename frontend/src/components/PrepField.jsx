import { useRef, useState } from "react";
import { LAYOUT } from "@/game/engine";
import { NeonButton, StatBar } from "@/components/ui-kit";
import { slotCap, towerDerived, canAfford } from "@/game/logic";
import { Wrench, Trash2, X } from "lucide-react";
import * as C from "@/game/config";

const { W, H, WALL_Y, GATE_Y, HERO_Y } = LAYOUT;
const pctX = (x) => `${(x / W) * 100}%`;
const pctY = (y) => `${(y / H) * 100}%`;
const clampX = (x) => Math.max(24, Math.min(W - 24, x));
const clampY = (y) => Math.max(34, Math.min(GATE_Y + 30, y)); // defensive zone only

export default function PrepField({ state, handlers }) {
  const [placing, setPlacing] = useState(null); // tower type key
  const [sel, setSel] = useState(null);         // {kind:'tower'|'barricade', idx}
  const fieldRef = useRef(null);
  const cap = slotCap(state);
  const n = state.heroes.length || 1;
  const atCap = state.towers.length >= cap;

  const toLogical = (e) => {
    const r = fieldRef.current.getBoundingClientRect();
    return { x: clampX(((e.clientX - r.left) / r.width) * W), y: clampY(((e.clientY - r.top) / r.height) * H) };
  };

  const placeAt = (e) => {
    if (!placing) return;
    const { x, y } = toLogical(e);
    handlers.build(placing, x, y);
    setPlacing(null);
  };

  const onTowerClick = (idx, e) => {
    e.stopPropagation();
    if (placing) return;
    setSel({ kind: "tower", idx });
  };

  return (
    <div className="flex flex-col items-center">
      {/* tower palette */}
      <div className="w-full max-w-md mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono-g text-[10px] text-slate-400">TOWERS {state.towers.length}/{cap}{atCap ? " · at capacity" : ""}</span>
          {placing && <button onClick={() => setPlacing(null)} className="font-mono-g text-[10px] text-rose-400 flex items-center gap-1" data-testid="cancel-placing"><X size={11} />cancel</button>}
        </div>
        <div className="grid grid-cols-4 gap-1.5" data-testid="tower-palette">
          {C.TOWER_ORDER.map((tp) => {
            const t = C.TOWERS[tp];
            const ok = !atCap && canAfford(state, t.construction);
            return (
              <button key={tp} disabled={!ok} data-testid={`palette-${tp}`}
                onClick={() => setPlacing(placing === tp ? null : tp)}
                className={`neon-btn p-1.5 rounded-lg border bg-black/40 disabled:opacity-30 ${placing === tp ? "ring-2 ring-cyan-400" : ""}`}
                style={{ borderColor: t.color + "66" }}>
                <div className="w-4 h-4 rounded mx-auto mb-1" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
                <div className="font-mono-g text-[9px] font-bold text-center" style={{ color: t.color }}>{t.name.split(" ")[0]}</div>
                <div className="font-mono-g text-[8px] text-slate-400 text-center">{t.construction.gold}g</div>
              </button>
            );
          })}
        </div>
        {placing && <p className="font-mono-g text-[10px] text-cyan-400 mt-1 animate-pulse-glow">Tap the battlefield to place {C.TOWERS[placing].name}</p>}
      </div>

      <div ref={fieldRef}
        className="relative rounded-xl overflow-hidden border border-cyan-500/20 mx-auto select-none"
        style={{ aspectRatio: `${W}/${H}`, width: "min(340px, 78vw)", background: "#12131A", touchAction: "none" }}
        data-testid="prep-battlefield">
        <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "10% 5.5%" }} />
        <div className="absolute left-0 right-0" style={{ top: pctY(WALL_Y), height: 2, background: "#FFE600", boxShadow: "0 0 10px #FFE600" }} />
        <div className="absolute left-0 right-0" style={{ top: pctY(GATE_Y), height: 2, background: "#FF2A5F", boxShadow: "0 0 10px #FF2A5F" }} />
        <div className="absolute" style={{ left: "50%", top: "96%", transform: "translate(-50%,-50%)", width: "34%", height: "4%", border: "2px solid #FF2A5F", boxShadow: "0 0 12px #FF2A5F" }} />
        <div className="absolute font-mono-g text-[8px] text-yellow-300/70" style={{ left: 4, top: `calc(${pctY(WALL_Y)} - 12px)` }}>OUTER WALL</div>
        <div className="absolute font-mono-g text-[8px] text-rose-400/70" style={{ left: 4, top: `calc(${pctY(GATE_Y)} - 12px)` }}>GATE</div>

        {/* barricade lanes */}
        {state.barricades.map((b, pos) => {
          const x = (W / 5) * (pos + 0.5); const on = b.maxHp > 0;
          return (
            <button key={pos} data-testid={`field-barricade-${pos}`} onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setSel({ kind: "barricade", idx: pos }); }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded"
              style={{ left: pctX(x), top: pctY(WALL_Y), width: "15%", height: "2.6%", pointerEvents: placing ? "none" : "auto",
                backgroundImage: on ? "repeating-linear-gradient(45deg,#FFE600 0,#FFE600 5px,#12131A 5px,#12131A 10px)" : "none",
                border: `1px solid ${on ? "#FFE600" : "rgba(255,230,0,0.35)"}`, opacity: on ? 0.5 + 0.5 * (b.hp / b.maxHp) : 0.4,
                outline: sel?.kind === "barricade" && sel.idx === pos ? "2px solid #00F3FF" : "none" }} />
          );
        })}

        {/* placed towers */}
        {state.towers.map((tw, idx) => {
          const t = C.TOWERS[tw.type];
          const pos = tw;
          return (
            <button key={tw.id} data-testid={`field-tower-${idx}`} onClick={(e) => onTowerClick(idx, e)}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded flex items-center justify-center bracket"
              style={{ left: pctX(pos.x), top: pctY(pos.y), width: "16%", height: "8%", borderColor: t.color,
                pointerEvents: placing ? "none" : "auto", cursor: "pointer",
                outline: sel?.kind === "tower" && sel.idx === idx ? "2px solid #00F3FF" : "none" }}>
              <div className="w-3.5 h-3.5 rounded" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
              <div className="absolute left-1 right-1 -bottom-1 h-1 rounded bg-black/80 overflow-hidden border border-white/10">
                <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, (tw.hp / Math.max(1, towerDerived(tw).maxHp)) * 100))}%`, background: tw.hp <= 0 ? "#FF0055" : t.color }} />
              </div>
              {tw.hp <= 0 && <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-mono-g text-rose-400">DESTROYED</span>}
              {tw.pending > 0 && <span className="absolute -top-1 -right-1 text-[8px] text-yellow-300 animate-pulse-glow">⬆</span>}
            </button>
          );
        })}

        {/* heroes */}
        {state.heroes.map((h, i) => {
          const c = C.HERO_CLASSES[h.cls];
          return <div key={h.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded"
            style={{ left: pctX(W * ((i + 0.5) / n)), top: pctY(HERO_Y), width: "5%", height: "5%", background: c.color, boxShadow: `0 0 8px ${c.color}`, pointerEvents: "none" }} />;
        })}

        {/* placement overlay captures taps anywhere */}
        {placing && <div className="absolute inset-0 z-20" style={{ cursor: "crosshair" }} onClick={placeAt} data-testid="place-overlay" />}
      </div>

      {/* action bar */}
      <div className="w-full max-w-md mt-2 min-h-[60px]">
        {!sel && !placing && <p className="font-mono-g text-[11px] text-slate-500 text-center py-3">Pick a tower above then tap the field to place it. Tap a placed tower or a barricade lane to configure. Towers stay fixed after placement.</p>}

        {sel?.kind === "tower" && state.towers[sel.idx] && (() => {
          const tw = state.towers[sel.idx]; const t = C.TOWERS[tw.type]; const d = towerDerived(tw);
          return (
            <div className="glass-card rounded-xl p-2.5 flex items-center gap-3" data-testid="tower-actions" style={{ borderLeft: `3px solid ${t.color}` }}>
              <div className="flex-1">
                <div className="font-mono-g text-xs font-bold" style={{ color: t.color }}>{t.name} L{tw.level} {tw.pending > 0 && <span className="text-yellow-300 animate-pulse-glow">⬆{tw.pending}</span>}</div>
                <StatBar frac={tw.hp / d.maxHp} color={t.color} height={4} />
                <div className="font-mono-g text-[8px] text-slate-400 mt-1">
                  {d.resourceLabel} {d.resourceKind === "ammo" ? Math.round(tw.ammo || 0) : Math.round(tw.mana || 0)}/{d.resourceKind === "ammo" ? d.maxAmmo : d.maxMana}
                  {tw.warlockDebuff > 0 && <span className="text-fuchsia-400 ml-2">WARLOCK DRAIN</span>}
                </div>
              </div>
              <NeonButton color="cyan" className="!px-2 !py-1 !text-[9px]" onClick={() => handlers.openCard(sel.idx)} data-testid={`field-tower-card-${sel.idx}`}>Card</NeonButton>
              <NeonButton color="yellow" className="!px-2 !py-1 !text-[9px]" onClick={() => handlers.resupplyTower(sel.idx)} data-testid={`field-resupply-tower-${sel.idx}`}>Supply</NeonButton>
              <NeonButton color="green" className="!px-2 !py-1 !text-[9px]" onClick={() => handlers.repairTower(sel.idx)} data-testid={`field-repair-tower-${sel.idx}`}><Wrench size={11} /></NeonButton>
              <NeonButton color="red" className="!px-2 !py-1 !text-[9px]" onClick={() => { handlers.dismantle(sel.idx); setSel(null); }} data-testid={`field-dismantle-${sel.idx}`}><Trash2 size={11} /></NeonButton>
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
