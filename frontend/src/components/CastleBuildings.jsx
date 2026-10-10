import { useState } from "react";
import { Coins, Mountain, Users, Hammer, ShieldCheck, Wrench, ChevronDown, ChevronUp } from "lucide-react";
import { NeonButton, SectionTitle, StatBar } from "@/components/ui-kit";
import { productionRates } from "@/game/logic";
import { workerCost } from "@/game/config";

const BUILDINGS = [
  { id: "mine", name: "Mine", icon: Coins, color: "#FFE600", desc: "Produces Gold from assigned Workers.", workers: "gold" },
  { id: "quarry", name: "Quarry", icon: Mountain, color: "#00F3FF", desc: "Produces Stone from assigned Workers.", workers: "stone" },
  { id: "tavern", name: "Tavern", icon: Users, color: "#FF007F", desc: "Hero recruitment and Morale services.", workers: null },
  { id: "shoppe", name: "Shoppe", icon: Coins, color: "#A855F7", desc: "Equipment and item transactions.", workers: null },
  { id: "academy", name: "Academy", icon: ShieldCheck, color: "#39FF14", desc: "Reserve-hero training unlocks later.", workers: null, locked: true },
  { id: "guild", name: "Guild", icon: Hammer, color: "#FF6600", desc: "Repairs and defensive support unlock later.", workers: null, locked: true },
  { id: "library", name: "Library", icon: ChevronUp, color: "#A855F7", desc: "Spell and perk research unlocks later.", workers: null, locked: true },
  { id: "vault", name: "Vault", icon: ShieldCheck, color: "#00F3FF", desc: "Protects deposited Gold when implemented.", workers: null, locked: true },
];

function initialBuilding(id) {
  return { level: 1, hp: 1000, maxHp: 1000, unlocked: !["academy", "guild", "library", "vault"].includes(id), activity: "Idle" };
}

function buildingState(state, id) {
  return state.buildings?.[id] || initialBuilding(id);
}

function condition(hp, maxHp) {
  const frac = maxHp > 0 ? hp / maxHp : 0;
  if (frac <= 0) return { label: "DISABLED", color: "#FF0055", efficiency: 0 };
  if (frac < 0.25) return { label: "CRITICAL", color: "#FF0055", efficiency: 0.25 };
  if (frac < 0.5) return { label: "DAMAGED", color: "#FF6600", efficiency: 0.5 };
  if (frac < 0.75) return { label: "DAMAGED", color: "#FFE600", efficiency: 0.75 };
  return { label: "HEALTHY", color: "#39FF14", efficiency: 1 };
}

export default function CastleBuildings({ state, mutate }) {
  const [selected, setSelected] = useState("mine");
  const [expanded, setExpanded] = useState(true);
  const rates = productionRates(state);
  const building = BUILDINGS.find((item) => item.id === selected) || BUILDINGS[0];
  const current = buildingState(state, building.id);
  const status = condition(current.hp, current.maxHp);
  const workersAssigned = building.workers === "gold" ? (state.workersGold || 0) : building.workers === "stone" ? (state.workersStone || 0) : 0;
  const availableWorkers = Math.max(0, (state.workers || 0) - (state.workersGold || 0) - (state.workersStone || 0));
  const baseRate = building.workers === "gold" ? rates.gold : building.workers === "stone" ? rates.stone : 0;
  const output = baseRate * status.efficiency * Math.pow(1.08, Math.max(0, (current.level || 1) - 1));
  const missingHp = Math.max(0, current.maxHp - current.hp);
  const repairGold = Math.ceil(missingHp * 0.2);
  const repairStone = Math.ceil(missingHp * 0.1);

  const updateBuilding = (fn) => mutate((s) => {
    s.buildings = s.buildings || {};
    s.buildings[building.id] = { ...initialBuilding(building.id), ...(s.buildings[building.id] || {}) };
    fn(s, s.buildings[building.id]);
  });

  const assign = (delta) => mutate((s) => {
    if (building.workers === "gold") {
      const next = Math.max(0, Math.min(s.workers || 0, (s.workersGold || 0) + delta));
      const actual = next - (s.workersGold || 0);
      if (actual > 0 && (s.workersStone || 0) + (s.workersGold || 0) + actual > s.workers) return;
      s.workersGold = next;
      s.workersStone = Math.max(0, (s.workersStone || 0) - Math.max(0, next - (s.workers || 0)));
    } else if (building.workers === "stone") {
      const next = Math.max(0, Math.min(s.workers || 0, (s.workersStone || 0) + delta));
      const actual = next - (s.workersStone || 0);
      if (actual > 0 && (s.workersStone || 0) + (s.workersGold || 0) + actual > s.workers) return;
      s.workersStone = next;
    }
  });

  const repair = () => {
    if (!missingHp || state.gold < repairGold || state.stone < repairStone) return;
    updateBuilding((s, b) => {
      if (s.gold < repairGold || s.stone < repairStone) return;
      s.gold -= repairGold;
      s.stone -= repairStone;
      b.hp = b.maxHp;
      b.activity = "Repaired";
    });
  };

  const upgrade = () => {
    const costGold = Math.ceil(100 * Math.pow(1.5, current.level - 1));
    const costStone = Math.ceil(40 * Math.pow(1.5, current.level - 1));
    updateBuilding((s, b) => {
      if (s.gold < costGold || s.stone < costStone) return;
      s.gold -= costGold;
      s.stone -= costStone;
      b.level = (b.level || 1) + 1;
      b.maxHp = Math.round((b.maxHp || 1000) * 1.15);
      b.hp = Math.min(b.maxHp, b.hp + Math.round(b.maxHp * 0.15));
      b.activity = "Upgraded";
    });
  };

  const upgradeCostGold = Math.ceil(100 * Math.pow(1.5, current.level - 1));
  const upgradeCostStone = Math.ceil(40 * Math.pow(1.5, current.level - 1));

  return (
    <section className="glass-card rounded-xl p-3 mb-4" data-testid="castle-management">
      <div className="flex items-center justify-between gap-2">
        <div>
          <SectionTitle color="magenta">Castle Buildings</SectionTitle>
          <p className="font-mono-g text-[10px] text-slate-500 mt-1">Map overview · Select a building to manage it</p>
        </div>
        <NeonButton color="cyan" className="!px-2 !py-1.5" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Collapse buildings" : "Expand buildings"}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </NeonButton>
      </div>

      {expanded && <>
        <div className="relative mt-3 rounded-xl border border-cyan-500/20 overflow-hidden p-3" style={{ background: "radial-gradient(circle at 50% 0%,rgba(168,85,247,.16),transparent 65%),#0b0d15" }} data-testid="castle-building-map">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {BUILDINGS.map((item, index) => {
              const b = buildingState(state, item.id);
              const c = condition(b.hp, b.maxHp);
              const Icon = item.icon;
              const locked = item.locked && !b.unlocked;
              return (
                <button key={item.id} type="button" onClick={() => setSelected(item.id)} data-testid={`castle-building-${item.id}`}
                  className={`relative rounded-lg border p-2 text-left min-h-[82px] transition-colors ${selected === item.id ? "bg-white/10 ring-1" : "bg-black/30"}`}
                  style={{ borderColor: selected === item.id ? item.color : item.color + "55", ringColor: item.color }}>
                  <div className="flex items-center justify-between gap-1">
                    <Icon size={20} style={{ color: item.color, filter: `drop-shadow(0 0 5px ${item.color})` }} />
                    <span className="text-[8px] font-mono-g" style={{ color: locked ? "#94A3B8" : c.color }}>{locked ? "LOCKED" : c.label}</span>
                  </div>
                  <div className="font-display font-bold text-xs mt-2" style={{ color: item.color }}>{item.name}</div>
                  <div className="h-1 rounded bg-white/10 mt-1 overflow-hidden"><div className="h-full" style={{ width: `${Math.max(0, Math.min(100, b.hp / Math.max(1, b.maxHp) * 100))}%`, background: c.color }} /></div>
                </button>
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-cyan-300/20" />
        </div>

        <div className="rounded-xl border bg-black/30 p-3 mt-3" style={{ borderColor: building.color + "66" }} data-testid="building-detail-panel">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display font-black text-lg" style={{ color: building.color }}>{building.name.toUpperCase()} · L{current.level || 1}</div>
              <p className="font-mono-g text-[10px] text-slate-400 mt-1">{building.desc}</p>
            </div>
            <div className="text-right"><div className="font-mono-g text-[10px]" style={{ color: status.color }}>{status.label}</div><div className="font-mono-g text-[9px] text-slate-500">{Math.round(current.hp)} / {current.maxHp} HP</div></div>
          </div>
          <div className="mt-2"><StatBar frac={current.hp / Math.max(1, current.maxHp)} color={status.color} height={5} /></div>

          {building.workers && <>
            <div className="flex items-center justify-between gap-2 mt-3 rounded-lg bg-white/5 p-2">
              <div><div className="font-mono-g text-[9px] text-slate-500">UNASSIGNED WORKERS</div><div className="font-display font-bold text-lg">{availableWorkers}</div></div>
              <NeonButton color="yellow" className="!text-[10px]" disabled={state.gold < workerCost(state.workers || 0)} onClick={() => mutate((s) => {
                const cost = workerCost(s.workers || 0);
                if (s.gold < cost) return;
                s.gold -= cost;
                s.workers = (s.workers || 0) + 1;
              })}>Hire Worker ({workerCost(state.workers || 0)}g)</NeonButton>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-white/5 p-2"><div className="font-mono-g text-[9px] text-slate-500">ASSIGNED WORKERS</div><div className="font-display font-bold text-xl">{workersAssigned}</div></div>
              <div className="rounded-lg bg-white/5 p-2"><div className="font-mono-g text-[9px] text-slate-500">CURRENT OUTPUT</div><div className="font-display font-bold text-xl" style={{ color: building.color }}>{output.toFixed(1)} / min</div></div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <NeonButton color="cyan" className="flex-1" disabled={workersAssigned <= 0} onClick={() => assign(-1)}>- Worker</NeonButton>
              <NeonButton color="green" className="flex-1" disabled={availableWorkers <= 0} onClick={() => assign(1)}>+ Worker</NeonButton>
            </div>
            <p className="font-mono-g text-[9px] text-slate-500 mt-1">Available workforce: {availableWorkers}. Damage-adjusted production is based on building condition.</p>
          </>}

          <div className="grid grid-cols-2 gap-2 mt-3">
            <NeonButton color="red" className="!text-[10px]" disabled={missingHp <= 0 || state.gold < repairGold || state.stone < repairStone} onClick={repair}>
              <Wrench size={12} className="mr-1" /> Repair ({repairGold}g / {repairStone}s)
            </NeonButton>
            <NeonButton color="yellow" className="!text-[10px]" disabled={state.gold < upgradeCostGold || state.stone < upgradeCostStone || !!(itemLocked(building.id, current))} onClick={upgrade}>
              Upgrade ({upgradeCostGold}g / {upgradeCostStone}s)
            </NeonButton>
          </div>
        </div>
      </>}
    </section>
  );
}

function itemLocked(id, current) {
  return ["academy", "guild", "library", "vault"].includes(id) && !current.unlocked;
}
