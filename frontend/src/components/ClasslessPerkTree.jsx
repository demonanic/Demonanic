import { CANONICAL_NODES, purchaseNode } from "../game/classlessProgression";

const REASONS = {
  invalid_progression: "Progression data is invalid",
  already_owned: "Already owned",
  phase_gated: "Unavailable — system pending",
  level_required: "Hero level required",
  prerequisite_required: "Prerequisite required",
  tier_iii_mastery_cap: "Two Tier III nodes already owned",
  insufficient_ap: "Not enough AP",
  unknown_node: "Unknown node",
};

export default function ClasslessPerkTree({ hero, onPurchase, onClose }) {
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
              Level {hero.progression.level} · {hero.progression.ap} AP · {owned.size} nodes owned
            </p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded border border-white/15 px-3 font-mono-g text-xs" data-testid="classless-perk-close">CLOSE</button>
        </header>
        <p className="py-3 font-mono-g text-[10px] text-yellow-200" data-testid="classless-perk-effects-notice">
          Purchases save node ownership and AP only. Combat effects are not enabled yet.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((branch) => (
            <section key={branch} className="rounded-lg border border-white/10 p-2" aria-label={`${branch} perks`}>
              <h3 className="mb-2 font-display font-bold text-sm text-cyan-100">{branch}</h3>
              <div className="space-y-1.5">
                {CANONICAL_NODES.filter((node) => node.branch === branch).map((node) => {
                  const result = purchaseNode(hero.progression, node.id);
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
