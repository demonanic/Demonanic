import { useState } from "react";
import { toast } from "sonner";
import { Brain, FlaskConical, BookOpen, Sparkles, Clock3 } from "lucide-react";
import { NeonButton, StatBar } from "@/components/ui-kit";
import { SPELL_ELEMENTS, SPELL_EFFECTS, LIBRARY_RULES, librarySuccessChance, createSpellBlueprint, startSpellResearch } from "@/game/libraryResearch";

export default function LibraryResearch({ state, mutate }) {
  const [mode, setMode] = useState("custom");
  const [element, setElement] = useState("fire");
  const [effect, setEffect] = useState("intensity");
  const [hours, setHours] = useState(6);
  const library = state.buildings?.library || { level: 1, hp: 1000, maxHp: 1000, unlocked: true };
  const blueprints = state.libraryBlueprints || [];
  const spells = state.librarySpells || [];
  const order = state.libraryResearch;
  const chance = librarySuccessChance(state);
  const ready = library.unlocked !== false && Number(library.hp) > 0;
  const researchProgress = order ? Math.max(0, Math.min(1, 1 - order.remainingSeconds / Math.max(1, order.durationSeconds))) : 0;

  const discover = () => mutate((s) => {
    const result = createSpellBlueprint(s, { mode, element, effect });
    if (!result.ok) {
      const message = result.reason === "resources" ? "Need 80 Gold and 20 Stone to attempt discovery." :
        result.reason === "catalog" ? "Every catalog spell has already been discovered." :
        result.reason === "library" ? "The Library must be repaired and unlocked." :
        `Design failed (${Math.round(result.chance)}% chance). Try higher Intelligence or Library level.`;
      toast.error(message);
    } else {
      toast.success(`Blueprint discovered: ${result.blueprint.name}`);
    }
  });

  const research = (blueprint) => mutate((s) => {
    const result = startSpellResearch(s, blueprint.id, hours);
    if (!result.ok) {
      toast.error(result.reason === "resources" ? `Research needs ${Math.ceil(hours * LIBRARY_RULES.researchGoldPerHour)} Gold and ${Math.ceil(hours * LIBRARY_RULES.researchStonePerHour)} Stone.` : "Finish the current research first.");
    } else toast.success(`Research started · ${result.durationHours} hours`);
  });

  return (
    <div className="mt-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-3" data-testid="library-spell-research">
      <div className="flex items-center justify-between gap-2">
        <div><div className="font-display font-bold text-lg text-fuchsia-100"><BookOpen size={16} className="inline mr-1" /> SPELL RESEARCH</div>
          <p className="font-mono-g text-[10px] text-slate-400">Discover blueprints, then choose research time to set the spell's strength.</p></div>
        <div className="text-right"><div className="font-mono-g text-[9px] text-slate-400">SUCCESS CHANCE</div><div className="font-display font-bold text-xl text-fuchsia-200">{Math.round(chance)}%</div></div>
      </div>
      {!ready && <p className="mt-2 text-xs text-rose-300">Repair and unlock the Library to continue.</p>}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button type="button" aria-pressed={mode === "custom"} onClick={() => setMode("custom")} className={`rounded border p-2 font-mono-g text-xs ${mode === "custom" ? "border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100" : "border-white/10 text-slate-400"}`}>CUSTOM DESIGN</button>
        <button type="button" aria-pressed={mode === "random"} onClick={() => setMode("random")} className={`rounded border p-2 font-mono-g text-xs ${mode === "random" ? "border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100" : "border-white/10 text-slate-400"}`}>RANDOM DISCOVERY</button>
      </div>
      {mode === "custom" && <div className="grid grid-cols-2 gap-2 mt-2">
        <label className="font-mono-g text-[10px] text-slate-300">ELEMENT<select aria-label="Spell element" value={element} onChange={(e) => setElement(e.target.value)} className="block w-full mt-1 rounded bg-black/50 border border-fuchsia-400/30 p-2 text-xs text-white">{SPELL_ELEMENTS.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
        <label className="font-mono-g text-[10px] text-slate-300">EFFECT<select aria-label="Spell effect" value={effect} onChange={(e) => setEffect(e.target.value)} className="block w-full mt-1 rounded bg-black/50 border border-fuchsia-400/30 p-2 text-xs text-white">{SPELL_EFFECTS.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
      </div>}
      <div className="mt-2 rounded bg-black/25 p-2 font-mono-g text-[10px] text-slate-400">
        <div><Sparkles size={12} className="inline mr-1" />Chance improves with the highest hero Intelligence and Library level.</div>
        <div>Elements: Fire · Ice · Poison · Electric · Mind</div><div>Effects: Area · Time · Intensity</div>
      </div>
      <NeonButton color="magenta" className="w-full mt-2" disabled={!ready || !!order || (state.gold || 0) < LIBRARY_RULES.discoveryGold || (state.stone || 0) < LIBRARY_RULES.discoveryStone} onClick={discover}><FlaskConical size={13} className="inline mr-1" /> {mode === "custom" ? "ROLL FOR CUSTOM BLUEPRINT" : "ROLL FOR RANDOM SPELL" } · 80G / 20S</NeonButton>

      {order && <div className="mt-3 rounded border border-fuchsia-400/30 bg-black/30 p-2" data-testid="library-active-research">
        <div className="font-display font-bold text-sm text-fuchsia-100"><Clock3 size={13} className="inline mr-1" /> RESEARCH IN PROGRESS</div>
        <div className="font-mono-g text-xs mt-1">{blueprints.find((item) => item.id === order.blueprintId)?.name || "Spell blueprint"}</div>
        <div className="font-mono-g text-[10px] text-slate-400">{Math.ceil(order.remainingSeconds / 3600)}h remaining · selected duration {order.chosenHours}h</div>
        <div className="mt-2"><StatBar frac={researchProgress} color="#D946EF" height={6} /></div>
      </div>}

      {blueprints.length > 0 && <div className="mt-3">
        <div className="font-display font-bold text-sm text-fuchsia-100">BLUEPRINTS ({blueprints.length})</div>
        {blueprints.map((blueprint) => <div key={blueprint.id} className="mt-2 rounded bg-black/25 p-2">
          <div className="font-display font-bold text-sm">{blueprint.name}</div>
          <div className="font-mono-g text-[10px] text-slate-400">{blueprint.element.toUpperCase()} · {blueprint.effect.toUpperCase()} · {blueprint.description}</div>
          {!order && <><label className="block mt-2 font-mono-g text-[10px] text-fuchsia-100">Research duration: {hours} hour{hours === 1 ? "" : "s"}</label><input aria-label={`Research hours for ${blueprint.name}`} type="range" min={LIBRARY_RULES.minResearchHours} max={LIBRARY_RULES.maxResearchHours} step="1" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full" /><div className="flex justify-between font-mono-g text-[9px] text-slate-500"><span>1h · quicker, weaker</span><span>24h · slower, stronger</span></div><div className="font-mono-g text-[10px] text-slate-400">Cost: {hours * LIBRARY_RULES.researchGoldPerHour} Gold / {hours * LIBRARY_RULES.researchStonePerHour} Stone</div><NeonButton color="magenta" className="w-full mt-2" disabled={!ready || !!order} onClick={() => research(blueprint)}>BEGIN RESEARCH</NeonButton></>}
        </div>)}
      </div>}

      <div className="mt-3 border-t border-fuchsia-400/20 pt-3">
        <div className="font-display font-bold text-sm text-fuchsia-100">KNOWN SPELLS ({spells.length})</div>
        {spells.length === 0 ? <p className="font-mono-g text-[10px] text-slate-500 mt-1">No spells researched yet.</p> : spells.map((spell) => <div key={spell.id} className="mt-2 rounded bg-black/25 p-2"><div className="font-display font-bold text-sm">{spell.name} <span className="text-fuchsia-200">· {spell.strength} power</span></div><div className="font-mono-g text-[10px] text-slate-400">{spell.element.toUpperCase()} · {spell.effect.toUpperCase()} · {spell.researchHours}h research · {spell.manaCost} mana</div><p className="font-mono-g text-[10px] text-slate-400 mt-1">{spell.description}</p></div>)}
      </div>
    </div>
  );
}
