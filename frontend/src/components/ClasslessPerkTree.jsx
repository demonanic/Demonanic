import { CANONICAL_NODES, purchaseClasslessNode } from "../game/classlessProgression";

const REASONS = {
  invalid_progression: "Progression data is invalid",
  already_owned: "Already owned",
  phase_gated: "Unavailable — system pending",
  effect_pending: "Unavailable — effect pending",
  level_required: "Hero level required",
  prerequisite_required: "Prerequisite required",
  tier_iii_mastery_cap: "Two Tier III nodes already owned",
  insufficient_ap: "Not enough AP",
  unknown_node: "Unknown node",
};

const EFFECT_LABELS = {
  V1: "+8% direct weapon damage (active)",
  P1: "+8 percentage points critical chance (active)",
  P2a: "+20 percentage points critical damage (active)",
  S1: "+5% attack speed (active)",
  T1: "+5% active cooldown reduction (active)",
  F1: "+15 percentage points critical damage (active)",
};

export default function ClasslessPerkTree({ hero, onPurchase, onAllocate, onClose }) {
  if (!hero || hero.cls || !hero.combat || !hero.progression) return null;
  const owned = new Set(hero.progression.ownedNodeIds || []);
  const branches = [...new Set(CANONICAL_NODES.map((node) => node.branch))];

  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-black/85 p-3" data-testid="classless-perk-tree">
      <section className="mx-auto max-w-3xl rounded-xl border border-cyan-400/40 bg-[#080b12] p-3 text-slate-100">
        <header className="flex items-center gap-3 border-b border-white/10 pb-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display font-black text-lg text-cyan-200">{hero.identity?.name || "Hero"} · UNIVERSAL PERKS</h2>
            <p className="font-mono-g text-[10px] text-slate-300" data-testid="classless-progression-balance">
              Level {hero.progression.level} · {hero.progression.xp} XP · {hero.progression.ap} AP · {owned.size} nodes owned
            </p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded border border-white/15 px-3 font-mono-g text-xs" data-testid="classless-perk-close">CLOSE</button>
        </header>
        <p className="py-3 font-mono-g text-[10px] text-yellow-200" data-testid="classless-perk-effects-notice">
          Only effects marked active are purchasable and wired to combat. Pending nodes cannot spend AP.
        </p>
        <section className="mb-4 rounded border border-cyan-400/20 p-3" aria-label="Allocate stat points">
          <div className="mb-2 font-mono-g text-[10px] text-cyan-100">STAT POINTS · {hero.progression.sp} SP</div>
          <p className="mb-2 font-mono-g text-[9px] text-slate-400">Attack, Defense, and Agility feed current combat stats. Intelligence is saved; classless spell scaling is not connected yet.</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(hero.combat.stats).map(([stat, value]) => (
              <button key={stat} type="button" disabled={hero.progression.sp <= 0}
                onClick={() => onAllocate?.(stat)} data-testid={`classless-allocate-${stat}`}
                className="min-h-10 rounded border border-white/15 px-2 text-left font-mono-g text-[10px] text-slate-100 disabled:opacity-40">
                {stat.toUpperCase()} · {value} · +1
              </button>
            ))}
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((branch) => (
            <section key={branch} className="rounded-lg border border-white/10 p-2" aria-label={`${branch} perks`}>
              <h3 className="mb-2 font-display font-bold text-sm text-cyan-100">{branch}</h3>
              <div className="space-y-1.5">
                {CANONICAL_NODES.filter((node) => node.branch === branch).map((node) => {
                  const result = purchaseClasslessNode(hero, node.id);
                  const isOwned = owned.has(node.id);
                  const label = isOwned ? "OWNED" : result.ok ? "PURCHASE" : REASONS[result.reason] || "Unavailable";
                  return (
                    <div key={node.id} className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.025] p-2" data-testid={`classless-node-${node.id}`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono-g text-xs font-bold text-slate-100">{node.id} · Tier {node.tier}</div>
                        <div className="font-mono-g text-[9px] text-slate-400">
                          {node.apCost} AP · Level {node.minLevel}
                          {node.prerequisites.length ? ` · Requires ${node.prerequisites.join(" or ")}` : " · No prerequisite"}
                        </div>
                        <div className={`font-mono-g text-[9px] ${EFFECT_LABELS[node.id] ? "text-emerald-300" : "text-amber-300"}`}>
                          {EFFECT_LABELS[node.id] || "Effect pending — ownership only"}
                        </div>
                        {node.gated && <div className="font-mono-g text-[9px] text-yellow-300">Unavailable — system pending</div>}
                      </div>
                      <button type="button" disabled={!result.ok} onClick={() => onPurchase?.(node.id)}
                        aria-label={`${node.id}: ${label}`} data-testid={`classless-node-purchase-${node.id}`}
                        className="min-h-10 min-w-24 rounded border border-cyan-400/30 px-2 font-mono-g text-[9px] text-cyan-100 disabled:border-white/10 disabled:text-slate-500">
                        {label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
