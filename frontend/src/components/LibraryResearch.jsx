import { useState } from "react";
import { toast } from "sonner";
import { Brain, FlaskConical, BookOpen, Sparkles, Clock3 } from "lucide-react";
import { NeonButton, StatBar } from "@/components/ui-kit";
import { SPELL_ELEMENTS, SPELL_EFFECTS, LIBRARY_RULES, librarySuccessChance, createSpellBlueprint, startSpellResearch, mageAffinities, mageIntelligence, spellIntelligenceRequirement, mageCanUseSpell, mageSpellbookCapacity, customSpellIntelligenceRequirement, randomDiscoveryPool } from "@/game/libraryResearch";

export default function LibraryResearch({ state, mutate }) {
  const [mode, setMode] = useState("custom");
  const [element, setElement] = useState("fire");
  const [effect, setEffect] = useState("intensity");
  const [hours, setHours] = useState(6);
  const order = state.libraryResearch;
  // A researching mage is shown only in the active-research status, not as an available assignment.
  const mages = [...(state.heroes || []), ...(state.bench || [])]
    .filter((hero) => hero?.cls === "mage" && hero.id !== order?.mageId);
  const [mageId, setMageId] = useState(mages[0]?.id || "");
  const mage = mages.find((hero) => hero.id === mageId) || mages[0] || null;
  const affinities = mageAffinities(mage);
  const intelligence = mage ? mageIntelligence(mage) : 0;
  const library = state.buildings?.library || { level: 1, hp: 1000, maxHp: 1000, unlocked: true };
  const blueprints = state.libraryBlueprints || [];
  const spells = state.librarySpells || [];
  const occupiedSlots = mage ? (mage.spellbook || []).length + blueprints.filter((blueprint) => blueprint.mageId === mage.id).length : 0;
  const spellCapacity = mageSpellbookCapacity(mage);
  const randomPoolSize = mage ? randomDiscoveryPool(state, mage).length : 0;
  const chance = librarySuccessChance(state, mage ? intelligence : 10);
  const ready = library.unlocked !== false && Number(library.hp) > 0;
  const researchProgress = order ? Math.max(0, Math.min(1, 1 - order.remainingSeconds / Math.max(1, order.durationSeconds))) : 0;

  const discover = () => mutate((s) => {
    const result = createSpellBlueprint(s, { mageId: mage?.id, mode, element, effect });
    if (!result.ok) {
      const message = result.reason === "resources" ? "Need 80 Gold and 20 Stone to attempt discovery." :
        result.reason === "catalog" || result.reason === "incompatible" ? mode === "random"
          ? "This mage has no undiscovered random spells matching their current affinity and Intelligence. Choose another mage, improve Intelligence, or unlock a secondary affinity at level 10."
          : "No undiscovered spell matches this mage's affinity, Intelligence, and selected design. Try another compatible element/effect or improve Intelligence." :
        result.reason === "mage" ? "Choose a mage before discovery." :
        result.reason === "capacity" ? "This mage has reached their spellbook limit. Level up to unlock more capacity." :
        result.reason === "intelligence" ? `Custom designs require Intelligence ${result.requiredIntelligence}. Train this mage first.` :
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
    } else toast.success(`Research started for ${result.mageName} · ${result.durationHours} hours`);
  });

  return (
    <div className="mt-3 rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-3" data-testid="library-spell-research">
      <div className="flex items-center justify-between gap-2">
        <div><div className="font-display font-bold text-lg text-fuchsia-100"><BookOpen size={16} className="inline mr-1" /> SPELL RESEARCH</div>
          <p className="font-mono-g text-[10px] text-slate-400">Discover blueprints, then choose research time to set the spell's strength.</p></div>
        <div className="text-right"><div className="font-mono-g text-[9px] text-slate-400">SUCCESS CHANCE</div><div className="font-display font-bold text-xl text-fuchsia-200">{Math.round(chance)}%</div></div>
      </div>
      {!ready && <p className="mt-2 text-xs text-rose-300">Repair and unlock the Library to continue.</p>}
      {mages.length === 0 ? <p className="mt-3 rounded border border-rose-400/30 p-2 text-xs text-rose-200">{order ? "Your assigned mage is busy researching. Other mages can be assigned after the current research finishes." : "A mage is required for spell discovery. Recruit or move a mage into your roster first."}</p> : (
        <div className="mt-3 rounded border border-fuchsia-400/20 bg-black/25 p-2">
          <label className="font-mono-g text-[10px] text-fuchsia-100">RESEARCH MAGE
            <select aria-label="Research mage" value={mage?.id || ""} onChange={(e) => { const next = mages.find((hero) => hero.id === e.target.value); setMageId(e.target.value); if (next && !mageAffinities(next).includes(element)) setElement(next.primaryAffinity); }} className="block w-full mt-1 rounded bg-black/50 border border-fuchsia-400/30 p-2 text-xs text-white">
              {mages.map((hero) => <option key={hero.id} value={hero.id}>{hero.name} · L{hero.level}{state.bench?.some((item) => item.id === hero.id) ? " · ROSTER" : " · SQUAD"}</option>)}
            </select>
          </label>
          {mage && <div className="mt-2 font-mono-g text-[10px] text-slate-300">
            <div>PRIMARY AFFINITY: <span className="text-fuchsia-200">{mage.primaryAffinity?.toUpperCase() || "UNSET"}</span>{mage.secondaryAffinity ? " · SECONDARY: " + mage.secondaryAffinity.toUpperCase() : ""}</div>
            <div>INTELLIGENCE {intelligence} · SPELL SUCCESS {Math.round(chance)}%</div><div>PERSONAL SPELLBOOK: {occupiedSlots}/{spellCapacity} slots</div>
            <div className="text-slate-500">A mage is assigned to the Library during research and returns to the roster when the spell is complete.</div>
          </div>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button type="button" aria-pressed={mode === "custom"} onClick={() => setMode("custom")} className={`rounded border p-2 font-mono-g text-xs ${mode === "custom" ? "border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100" : "border-white/10 text-slate-400"}`}>CUSTOM DESIGN</button>
        <button type="button" aria-pressed={mode === "random"} onClick={() => setMode("random")} className={`rounded border p-2 font-mono-g text-xs ${mode === "random" ? "border-fuchsia-300 bg-fuchsia-300/15 text-fuchsia-100" : "border-white/10 text-slate-400"}`}>RANDOM DISCOVERY</button>
      </div>
      {mode === "random" && mage && (
        <p className="mt-2 font-mono-g text-[10px] text-slate-300" data-testid="random-discovery-pool">
          {randomPoolSize
            ? `${randomPoolSize} eligible undiscovered spell${randomPoolSize === 1 ? "" : "s"}`
            : "No eligible undiscovered spells for this mage"}
        </p>
      )}
      {mode === "custom" && <div className="grid grid-cols-2 gap-2 mt-2">
        <label className="font-mono-g text-[10px] text-slate-300">ELEMENT<select aria-label="Spell element" value={element} onChange={(e) => setElement(e.target.value)} className="block w-full mt-1 rounded bg-black/50 border border-fuchsia-400/30 p-2 text-xs text-white">{SPELL_ELEMENTS.map((item) => <option key={item} value={item} disabled={!affinities.includes(item)}>{item.toUpperCase()}{affinities.includes(item) ? "" : " · NO AFFINITY"}</option>)}</select></label>
        <label className="font-mono-g text-[10px] text-slate-300">EFFECT<select aria-label="Spell effect" value={effect} onChange={(e) => setEffect(e.target.value)} className="block w-full mt-1 rounded bg-black/50 border border-fuchsia-400/30 p-2 text-xs text-white">{SPELL_EFFECTS.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>
      </div>}
      <div className="mt-2 rounded bg-black/25 p-2 font-mono-g text-[10px] text-slate-400">
        <div><Sparkles size={12} className="inline mr-1" />Chance uses the selected mage Intelligence and Library level.</div>
        <div>Elements: Fire · Ice · Poison · Electric · Mind</div><div>Effects: Area · Time · Intensity</div>
      </div>
      <NeonButton color="magenta" className="w-full mt-2" disabled={!ready || !mage || occupiedSlots >= spellCapacity || (mode === "custom" && (!affinities.includes(element) || intelligence < customSpellIntelligenceRequirement(mage))) || !!order || (state.gold || 0) < LIBRARY_RULES.discoveryGold || (state.stone || 0) < LIBRARY_RULES.discoveryStone} onClick={discover}><FlaskConical size={13} className="inline mr-1" /> {mode === "custom" ? "ROLL FOR CUSTOM BLUEPRINT" : "ROLL FOR RANDOM SPELL" } · 80G / 20S</NeonButton>

      {order && <div className="mt-3 rounded border border-fuchsia-400/30 bg-black/30 p-2" data-testid="library-active-research">
        <div className="font-display font-bold text-sm text-fuchsia-100"><Clock3 size={13} className="inline mr-1" /> RESEARCH IN PROGRESS</div>
        <div className="font-mono-g text-xs mt-1">{blueprints.find((item) => item.id === order.blueprintId)?.name || "Spell blueprint"} · {blueprints.find((item) => item.id === order.blueprintId)?.mageName || "Assigned mage"}</div>
        <div className="font-mono-g text-[10px] text-slate-400">{Math.ceil(order.remainingSeconds / 3600)}h remaining · selected duration {order.chosenHours}h</div>
        <div className="mt-2"><StatBar frac={researchProgress} color="#D946EF" height={6} /></div>
      </div>}

      {blueprints.length > 0 && <div className="mt-3">
        <div className="font-display font-bold text-sm text-fuchsia-100">BLUEPRINTS ({blueprints.length})</div>
        {blueprints.map((blueprint) => <div key={blueprint.id} className="mt-2 rounded bg-black/25 p-2">
          <div className="font-display font-bold text-sm">{blueprint.name}</div>
          <div className="font-mono-g text-[10px] text-slate-400">{blueprint.element.toUpperCase()} · {blueprint.effect.toUpperCase()} · INT {spellIntelligenceRequirement(blueprint)} · {blueprint.description}</div><div className="font-mono-g text-[9px] text-fuchsia-200/80">Assigned to {blueprint.mageName || "mage"}</div>
          {!order && <><label className="block mt-2 font-mono-g text-[10px] text-fuchsia-100">Research duration: {hours} hour{hours === 1 ? "" : "s"}</label><input aria-label={`Research hours for ${blueprint.name}`} type="range" min={LIBRARY_RULES.minResearchHours} max={LIBRARY_RULES.maxResearchHours} step="1" value={hours} onChange={(e) => setHours(Number(e.target.value))} className="w-full" /><div className="flex justify-between font-mono-g text-[9px] text-slate-500"><span>1h · quicker, weaker</span><span>24h · slower, stronger</span></div><div className="font-mono-g text-[10px] text-slate-400">Cost: {hours * LIBRARY_RULES.researchGoldPerHour} Gold / {hours * LIBRARY_RULES.researchStonePerHour} Stone</div><NeonButton color="magenta" className="w-full mt-2" disabled={!ready || !!order || !mages.some((hero) => hero.id === blueprint.mageId && mageCanUseSpell(hero, blueprint))} onClick={() => research(blueprint)}>BEGIN RESEARCH</NeonButton></>}
        </div>)}
      </div>}

      <div className="mt-3 border-t border-fuchsia-400/20 pt-3">
        <div className="font-display font-bold text-sm text-fuchsia-100">PERSONAL SPELLBOOKS · LEGACY SPELLS ({spells.length})</div>
        {spells.length === 0 ? <p className="font-mono-g text-[10px] text-slate-500 mt-1">New research is stored in the assigned mage personal spellbook.</p> : spells.map((spell) => <div key={spell.id} className="mt-2 rounded bg-black/25 p-2"><div className="font-display font-bold text-sm">{spell.name} <span className="text-fuchsia-200">· {spell.strength} power</span></div><div className="font-mono-g text-[10px] text-slate-400">{spell.element.toUpperCase()} · {spell.effect.toUpperCase()} · {spell.researchHours}h research · {spell.manaCost} mana</div><p className="font-mono-g text-[10px] text-slate-400 mt-1">{spell.description}</p></div>)}
      </div>
    </div>
  );
}
