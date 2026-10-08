import { useMemo, useState } from "react";
import { X, Lock, Check, Zap, CircleDot } from "lucide-react";
import * as C from "@/game/config";
import { getPerkTree, normalizePerks, canUnlockPerk, unlockedAbilities } from "@/game/perks";

const CATEGORY_STYLE = {
  STAT: "border-cyan-400/40 text-cyan-300",
  ITEM: "border-yellow-400/40 text-yellow-300",
  ENEMY: "border-rose-400/40 text-rose-300",
};

export default function PerkTree({ hero, editable = false, onPerk, onClose }) {
  const cls = C.HERO_CLASSES[hero.cls];
  const tree = getPerkTree(hero.cls);
  const owned = useMemo(() => normalizePerks(hero.cls, hero.perks), [hero.cls, hero.perks]);
  const abilities = unlockedAbilities(hero);
  const [focus, setFocus] = useState(null);
  const focused = focus
    ? [...tree.roots, ...tree.children].find((p) => p.id === focus) || tree.abilities.find((a) => a.id === focus)
    : null;

  const node = (p) => {
    const selected = owned.includes(p.id);
    const available = editable && canUnlockPerk(hero, hero.cls, p.id);
    const lockedByParent = !!p.parent && !owned.includes(p.parent);
    const lockedByAp = Number(hero.ap || 0) < p.cost;
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => { setFocus(p.id); if (available) onPerk?.(p.id); }}
        className={"w-full text-left rounded-lg border p-2 transition-all " +
          (selected ? "bg-green-500/10 border-green-400/60 shadow-[0_0_12px_rgba(57,255,20,.12)] " :
           available ? "bg-fuchsia-500/10 border-fuchsia-400/60 " :
           "bg-black/30 border-white/10 opacity-60 ")}
        data-testid={"perk-node-" + p.id}
      >
        <div className="flex items-center gap-1.5">
          {selected ? <Check size={11} className="text-green-400 shrink-0" /> :
           (lockedByParent || lockedByAp) ? <Lock size={10} className="text-slate-500 shrink-0" /> :
           <CircleDot size={10} className="text-fuchsia-300 shrink-0" />}
          <span className={"font-mono-g text-[10px] font-bold flex-1 " + (selected ? "text-green-300" : "text-slate-200")}>{p.name}</span>
          <span className="font-mono-g text-[8px] text-fuchsia-300">{p.cost} AP</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <span className={"font-mono-g text-[7px] px-1 py-0.5 rounded border " + (CATEGORY_STYLE[p.category] || "border-white/10 text-slate-400")}>{p.category}</span>
          <span className="font-mono-g text-[7px] text-slate-500 truncate">{p.desc}</span>
        </div>
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] pointer-events-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="absolute inset-x-2 top-3 bottom-3 flex flex-col rounded-2xl border border-fuchsia-400/40 bg-[#080b12]/95 shadow-[0_0_40px_rgba(217,70,239,.2)] overflow-hidden">
        <header className="shrink-0 p-3 border-b border-white/10 flex items-center gap-2" style={{ borderTop: "3px solid " + cls.color }}>
          <div className="min-w-0 flex-1">
            <div className="font-display font-black text-lg" style={{ color: cls.color }}>{cls.name.toUpperCase()} · PRK TREE</div>
            <div className="font-mono-g text-[8px] text-slate-500">Choose a path. Parent PRKs unlock child branches. Intersections unlock battlefield abilities.</div>
          </div>
          <div className="font-mono-g text-[9px] text-fuchsia-300 whitespace-nowrap">AP {hero.ap || 0}</div>
          <button onClick={onClose} className="p-1 text-slate-500 hover:text-white" data-testid="perk-tree-close"><X size={17} /></button>
        </header>

        <div className="shrink-0 px-3 py-2 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-white/5">
          <span className="font-mono-g text-[7px] text-cyan-300 border border-cyan-400/30 rounded px-1.5 py-1">STAT</span>
          <span className="font-mono-g text-[7px] text-yellow-300 border border-yellow-400/30 rounded px-1.5 py-1">ITEM</span>
          <span className="font-mono-g text-[7px] text-rose-300 border border-rose-400/30 rounded px-1.5 py-1">ENEMY</span>
          <span className="font-mono-g text-[7px] text-slate-500 ml-auto">SELECTED {owned.length}</span>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-3 gap-4">
              {tree.roots.map((root) => (
                <div key={root.id} className="space-y-2">
                  <div className="font-mono-g text-[8px] uppercase tracking-[.2em] text-slate-500 text-center">FOUNDATION</div>
                  {node(root)}
                  <div className="pl-3 border-l border-white/10 space-y-2">
                    {tree.children.filter((p) => p.parent === root.id).map(node)}
                  </div>
                </div>
              ))}
            </div>

            <div className="my-4 border-t border-fuchsia-400/20" />

            <div className="font-mono-g text-[9px] text-fuchsia-300 uppercase tracking-[.2em] mb-2 flex items-center gap-1">
              <Zap size={11} /> COMPOSITE BATTLEFIELD ABILITIES
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tree.abilities.map((a) => {
                const unlocked = abilities.some((x) => x.id === a.id);
                return (
                  <button key={a.id} type="button" onClick={() => setFocus(a.id)}
                    className={"text-left rounded-lg border p-2 " + (unlocked ? "border-fuchsia-400/60 bg-fuchsia-500/10" : "border-white/10 bg-black/20 opacity-55")}
                    data-testid={"ability-node-" + a.id}>
                    <div className="flex items-center gap-1.5">
                      {unlocked ? <Check size={11} className="text-green-400" /> : <Lock size={10} className="text-slate-500" />}
                      <span className="font-mono-g text-[10px] font-bold flex-1" style={{ color: a.color }}>{a.name}</span>
                      <span className="font-mono-g text-[7px] text-slate-500">{a.cooldown}s CD</span>
                    </div>
                    <div className="font-mono-g text-[8px] text-slate-400 mt-1">{a.desc}</div>
                    <div className="font-mono-g text-[7px] text-slate-600 mt-1">Requires: {a.requires.map((id) => [...tree.roots, ...tree.children].find((p) => p.id === id)?.name || id).join(" + ")}</div>
                  </button>
                );
              })}
            </div>

            {focused && (
              <div className="mt-3 rounded-lg border border-cyan-400/20 bg-black/40 p-2">
                <div className="font-mono-g text-[9px] text-cyan-300 uppercase tracking-widest">FOCUS</div>
                <div className="font-display font-bold text-sm mt-1" style={{ color: focused.color || cls.color }}>{focused.name}</div>
                <div className="font-mono-g text-[9px] text-slate-300 mt-1">{focused.desc}</div>
                {focused.requires && <div className="font-mono-g text-[8px] text-slate-500 mt-1">PRK intersection: {focused.requires.join(" · ")}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
