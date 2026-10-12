import { useEffect, useRef, useState } from "react";
import { LAYOUT, slotPositions } from "@/game/engine";
import { NeonButton, StatBar } from "@/components/ui-kit";
import { slotCap, towerDerived, canAfford } from "@/game/logic";
import { Wrench, Trash2, X } from "lucide-react";
import * as C from "@/game/config";

const { W, H, WALL_Y, GATE_Y, HERO_Y } = LAYOUT;
const pctX = (x) => `${(x / W) * 100}%`;
const pctY = (y) => `${(y / H) * 100}%`;
const PLACEMENT_SLOTS = slotPositions();

export default function PrepField({ state, handlers }) {
  const [placing, setPlacing] = useState(null); // tower type key
  const [pendingPosition, setPendingPosition] = useState(null); // uncommitted placement preview
  const [awaitingPlacement, setAwaitingPlacement] = useState(null); // waits for committed tower to appear in state
  const [sel, setSel] = useState(null);         // {kind:'tower'|'barricade', idx}
  const fieldRef = useRef(null);
  const cap = slotCap(state);
  const n = state.heroes.length || 1;
  const atCap = state.towers.length >= cap;

  // Assign each existing tower to one unique visual slot, including legacy
  // saves whose coordinates predate slot-based placement. Keep the saved
  // coordinates untouched: this mapping affects preparation-screen display only.
  const towerSlotAssignments = (() => {
    const pairs = state.towers.flatMap((tower, towerIndex) =>
      PLACEMENT_SLOTS.map((slot, slotIndex) => ({
        towerIndex, slotIndex,
        distance: Math.hypot(tower.x - slot.x, tower.y - slot.y),
      }))
    ).sort((a, b) => a.distance - b.distance);
    const assignedTowers = new Set();
    const assignedSlots = new Set();
    const result = Array(state.towers.length).fill(null);
    for (const pair of pairs) {
      if (assignedTowers.has(pair.towerIndex) || assignedSlots.has(pair.slotIndex)) continue;
      assignedTowers.add(pair.towerIndex);
      assignedSlots.add(pair.slotIndex);
      result[pair.towerIndex] = PLACEMENT_SLOTS[pair.slotIndex];
    }
    return result;
  })();
  const isSlotOccupied = (slot) => towerSlotAssignments.some((assigned) =>
    assigned && assigned.x === slot.x && assigned.y === slot.y
  );

  // Keep the preview visible until the state actually contains the newly built
  // tower. handlers.build queues a React state mutation, so its return value
  // alone is not proof that placement succeeded.
  useEffect(() => {
    if (!awaitingPlacement) return;
    const committed = state.towers.some((tower) =>
      !awaitingPlacement.existingIds.has(tower.id) &&
      tower.type === awaitingPlacement.type &&
      tower.x === awaitingPlacement.x &&
      tower.y === awaitingPlacement.y
    );
    if (committed) {
      setPendingPosition(null);
      setPlacing(null);
      setSel(null);
      setAwaitingPlacement(null);
    }
  }, [state.towers, awaitingPlacement]);

  const toLogical = (e) => {
    // Placement uses the exact logical positions consumed by the battle engine.
    // Snap to the nearest unoccupied slot instead of saving arbitrary touch
    // coordinates that can be difficult to judge against the live canvas.
    const r = fieldRef.current.getBoundingClientRect();
    const point = {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
    const available = PLACEMENT_SLOTS
      .map((slot, index) => ({ ...slot, index }))
      .filter((slot) => !isSlotOccupied(slot) || (
        pendingPosition && pendingPosition.x === slot.x && pendingPosition.y === slot.y
      ));
    if (!available.length) return null;
    return available.reduce((best, slot) => {
      const distance = (slot.x - point.x) ** 2 + (slot.y - point.y) ** 2;
      return !best || distance < best.distance ? { x: slot.x, y: slot.y, distance } : best;
    }, null);
  };

  const placeAt = (e) => {
    if (!placing || e.button > 0) return;
    // Use the initial pointer-down coordinates on touch devices. A synthesized
    // click can arrive after the mobile viewport has shifted or reflowed.
    e.preventDefault();
    e.stopPropagation();
    const point = toLogical(e);
    if (!point) return;
    setAwaitingPlacement(null);
    setPendingPosition({ type: placing, x: point.x, y: point.y });
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
          {placing && <button onClick={() => { setPlacing(null); setPendingPosition(null); setAwaitingPlacement(null); }} className="font-mono-g text-[10px] text-rose-400 flex items-center gap-1" data-testid="cancel-placing"><X size={11} />cancel</button>}
        </div>
        <div className="grid grid-cols-4 gap-1.5" data-testid="tower-palette">
          {C.TOWER_ORDER.map((tp) => {
            const t = C.TOWERS[tp];
            const ok = !atCap && canAfford(state, t.construction);
            return (
              <button key={tp} disabled={!ok} data-testid={`palette-${tp}`}
                onClick={() => { setPendingPosition(null); setAwaitingPlacement(null); setPlacing(placing === tp ? null : tp); }}
                className={`neon-btn p-1.5 rounded-lg border bg-black/40 disabled:opacity-30 ${placing === tp ? "ring-2 ring-cyan-400" : ""}`}
                style={{ borderColor: t.color + "66" }}>
                <div className="w-4 h-4 rounded mx-auto mb-1" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
                <div className="font-mono-g text-[9px] font-bold text-center" style={{ color: t.color }}>{t.name.split(" ")[0]}</div>
                <div className="font-mono-g text-[8px] text-slate-400 text-center">{t.construction.gold}g</div>
              </button>
            );
          })}
        </div>
        {placing && <p className="font-mono-g text-[10px] text-cyan-400 mt-1 animate-pulse-glow">{pendingPosition ? "Preview snapped to a marked slot — tap another slot area to reposition, or confirm below." : `Tap near a marked slot to preview ${C.TOWERS[placing].name}`}</p>}
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

        {/* Exact tower positions used by the live battle engine. Occupied sites are marked. */}
        {PLACEMENT_SLOTS.map((slot, index) => {
          const occupied = isSlotOccupied(slot);
          const previewed = pendingPosition?.x === slot.x && pendingPosition?.y === slot.y;
          return (
            <button key={index} type="button" data-testid={`tower-slot-${index}`}
              aria-label={occupied ? `Tower slot ${index + 1}, occupied` : `Place tower at slot ${index + 1}`}
              disabled={!placing || (occupied && !previewed)}
              onPointerDown={(e) => {
                if (!placing || (occupied && !previewed)) return;
                e.preventDefault();
                e.stopPropagation();
                setAwaitingPlacement(null);
                setPendingPosition({ type: placing, x: slot.x, y: slot.y });
              }}
              className="absolute z-30 rounded-full flex items-center justify-center font-mono-g text-[8px] font-bold disabled:cursor-not-allowed"
              style={{
                left: pctX(slot.x), top: pctY(slot.y), transform: "translate(-50%, -50%)", width: "12%", aspectRatio: "1",
                border: `2px ${previewed ? "dashed" : "solid"} ${occupied ? "#64748B" : previewed ? C.TOWERS[pendingPosition.type].color : "#00F3FF"}`,
                background: occupied ? "rgba(100,116,139,0.2)" : previewed ? "rgba(0,243,255,0.18)" : "rgba(0,243,255,0.06)",
                color: occupied ? "#64748B" : "#00F3FF",
                boxShadow: previewed ? "0 0 12px #00F3FF66" : "none",
                // Slot badges should only intercept touches while choosing an available slot.
                // Otherwise they sit above placed towers and block repair/resupply selection.
                pointerEvents: placing && !occupied ? "auto" : "none",
              }}>{occupied ? "USED" : `SLOT ${index + 1}`}</button>
          );
        })}

        {/* placed towers */}
        {state.towers.map((tw, idx) => {
          const t = C.TOWERS[tw.type];
          // Use the same unique slot assignment as the occupied markers.
          const pos = towerSlotAssignments[idx] || tw;
          return (
            <button key={tw.id} data-testid={`field-tower-${idx}`} onClick={(e) => onTowerClick(idx, e)}
              className="absolute rounded flex items-center justify-center bracket"
              style={{ position: "absolute", left: pctX(pos.x), top: pctY(pos.y), transform: "translate(-50%, -50%)", width: "10%", height: "5%", borderColor: t.color,
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

        {/* uncommitted placement preview: resources are untouched until confirmation */}
        {pendingPosition && placing && (
          <div data-testid="tower-placement-preview" className="absolute rounded flex items-center justify-center border-2 border-dashed animate-pulse"
            style={{ left: pctX(pendingPosition.x), top: pctY(pendingPosition.y), transform: "translate(-50%, -50%)", width: "10%", height: "5%", borderColor: C.TOWERS[pendingPosition.type].color, background: C.TOWERS[pendingPosition.type].color + "22", boxShadow: "0 0 12px " + C.TOWERS[pendingPosition.type].color + "66", pointerEvents: "none" }}>
            <div className="w-3.5 h-3.5 rounded" style={{ background: C.TOWERS[pendingPosition.type].color, boxShadow: "0 0 8px " + C.TOWERS[pendingPosition.type].color }} />
          </div>
        )}

        {/* heroes */}
        {state.heroes.map((h, i) => {
          const c = C.HERO_CLASSES[h.cls];
          return <div key={h.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded"
            style={{ left: pctX(W * ((i + 0.5) / n)), top: pctY(HERO_Y), width: "5%", height: "5%", background: c.color, boxShadow: `0 0 8px ${c.color}`, pointerEvents: "none" }} />;
        })}

        {/* placement overlay captures taps anywhere */}
        {placing && <div className="absolute inset-0 z-20" style={{ cursor: "crosshair", touchAction: "none" }} onPointerDown={placeAt} data-testid="place-overlay" />}
      </div>

      {/* placement confirmation: committing is explicit; cancel returns resources untouched */}
      {placing && pendingPosition && (
        <div className="w-full max-w-md mt-2 grid grid-cols-2 gap-2" data-testid="tower-placement-confirmation">
          <NeonButton color="green" className="!py-2" onClick={() => {
            if (awaitingPlacement) return;
            const pending = pendingPosition;
            const existingIds = new Set(state.towers.map((tower) => tower.id));
            const placed = handlers.build(pending.type, pending.x, pending.y);
            if (placed !== false) {
              setAwaitingPlacement({
                type: pending.type,
                x: pending.x,
                y: pending.y,
                existingIds,
              });
            }
          }} data-testid="confirm-tower-placement" disabled={!!awaitingPlacement}>{awaitingPlacement ? "PLACING…" : "CONFIRM PLACEMENT"}</NeonButton>
          <NeonButton color="red" className="!py-2" onClick={() => {
            setPendingPosition(null);
            setPlacing(null);
            setAwaitingPlacement(null);
          }} data-testid="disengage-tower-placement">DISENGAGE / CANCEL</NeonButton>
        </div>
      )}

      {/* action bar */}
      <div className="w-full max-w-md mt-2 min-h-[60px]">
        {!sel && !placing && <p className="font-mono-g text-[11px] text-slate-500 text-center py-3">Pick a tower, tap near an available marked slot, then confirm. Occupied slots cannot be reused. Tap a placed tower or barricade lane to configure.</p>}

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
