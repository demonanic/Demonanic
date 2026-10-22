import { useState } from "react";
import {
  BookOpen, Crosshair, Eye, Heart, Info, Move, Shield, Sparkles, Swords, UsersRound, X,
} from "lucide-react";
import { NeonButton, HeroMiniSprite } from "./ui-kit";
import * as C from "../game/config";
import { getPerk } from "../game/perks";

const CATEGORIES = [
  { id: "tactics", label: "Tactics", Icon: Move, color: "cyan" },
  { id: "combat", label: "Combat", Icon: Swords, color: "yellow" },
  { id: "abilities", label: "Abilities", Icon: Sparkles, color: "fuchsia" },
  { id: "spells", label: "Spells", Icon: BookOpen, color: "violet" },
  { id: "squad", label: "Squad", Icon: UsersRound, color: "green" },
];

const abilityReasonText = (reason) => ({
  no_target: "NO VALID TARGET",
  target_health: "TARGET HP TOO HIGH",
  cooldown: "COOLDOWN",
  locked: "LOCKED",
  unavailable: "UNAVAILABLE",
}[reason] || "UNAVAILABLE");

function ActionInfo({ id, description, openId, onToggle, children }) {
  const expanded = openId === id;
  return (
    <div className="min-w-0">
      {children}
      <button
        type="button"
        className="mt-1 flex min-h-9 w-full items-center justify-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 font-mono-g text-[8px] text-slate-300"
        aria-expanded={expanded}
        aria-label={`More information: ${id}`}
        onClick={() => onToggle(expanded ? null : id)}
        data-testid={`tactical-info-${id}`}
      >
        <Info size={12} /> INFO
      </button>
      {expanded && description && (
        <div className="mt-1 rounded border border-white/10 bg-black/40 p-2 font-mono-g text-[9px] leading-relaxed text-slate-200">
          {description}
        </div>
      )}
    </div>
  );
}

export default function TacticalMenu({
  visible = true, open = false, disabled = false, onOpen, onClose,
  heroes = [], selectedHero, onSelectHero, switchDisabled = false, commandMode = "move",
  onManual, onAuto, onCommandMode, gold = 0,
  onRetreat, onRally, onRevive, onDetails, onAbility, abilityStatus = [], onCastSpell, spellStatus = [],
  targetSelection = null, targetFeedback = "", onSelectRangedTarget, onCancelTarget, heroStatuses = [],
  onBeginAbilityTarget, onBeginSpellTarget,
  opaque = false, onToggleOpaque, blockadeStatus, blockadeCanActivate = false, blockadeCost = null, onActivateBlockade,
}) {
  const [category, setCategory] = useState("squad");
  const [infoId, setInfoId] = useState(null);
  if (!visible) return null;

  const selected = selectedHero != null ? heroes[selectedHero] : null;
  const selectedClassless = !!selected && !selected.cls && !!selected.combat;
  const selectedStatus = selectedHero != null ? heroStatuses[selectedHero] || {} : {};
  const selectedHp = Number(selectedStatus.hp ?? selected?.combat?.hp ?? selected?.hp) || 0;
  const selectedMaxHp = Math.max(1, Number(selectedStatus.maxHp ?? selected?.combat?.maxHp ?? selected?.maxHp) || 1);
  const selectedDead = !!selected && (selectedStatus.alive === false || selectedHp <= 0);
  const cls = selected ? C.HERO_CLASSES[selected.cls] : null;
  const selectedName = selectedClassless ? selected.identity?.name || "Classless Hero" : cls?.name || "HERO";
  const selectedAp = selectedClassless ? selected.progression?.ap : selected?.ap;
  const selectedSp = selectedClassless ? selected.progression?.sp : selected?.sp;
  const passivePerks = selected ? (selected.perks || []).map((id) => getPerk(selected.cls, id)).filter(Boolean) : [];
  const reviveCost = selected ? C.paidRevivalCost(selected.level) : 0;
  const isManual = !!selected?.manual;
  const panelOpen = open && !!category;
  const toggleCategory = (id) => {
    if (disabled) return;
    if (open && category === id) {
      setCategory(null);
      onClose?.();
      return;
    }
    setCategory(id);
    onOpen?.();
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-2 pb-[env(safe-area-inset-bottom)]"
      data-testid="tactical-command-dock"
    >
      {panelOpen && (
        <section
          className={`pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-xl border shadow-lg ${
            opaque ? "bg-[#090b12]" : "bg-[#090b12]/95 backdrop-blur-md"
          }`}
          style={{ borderColor: "#E879F966" }}
          aria-label={`${CATEGORIES.find((item) => item.id === category)?.label || "Squad"} actions`}
          data-testid="tactical-menu"
        >
          <div className="flex min-h-12 items-center gap-2 border-b border-white/10 px-2">
            {selected && (
              selectedClassless
                ? <span className="h-8 w-8 rounded border border-cyan-400/30 bg-black/30" aria-label={selected.appearance?.id ? `Appearance ${selected.appearance.id}` : "Appearance not selected"} />
                : <HeroMiniSprite cls={selected.cls} color={cls?.color} size="sm" dead={selectedDead} />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono-g text-[10px] font-bold uppercase tracking-wide text-cyan-100">
                {selected ? `${selectedName} · ${category}` : `${category} · Select a hero in Squad`}
              </div>
              {selected && (
                <div className="font-mono-g text-[8px] text-slate-300">
                  {selectedDead ? "FALLEN" : `${Math.round(selectedHp)}/${Math.round(selectedMaxHp)} HP`}
                  {" · "}{Math.floor(gold)}G{selectedAp != null ? ` · ${selectedAp} AP` : ""}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onToggleOpaque}
              className="min-h-11 rounded border border-white/10 px-2 font-mono-g text-[7px] text-slate-200"
              aria-label={`Set HUD ${opaque ? "floating" : "opaque"}`}
              data-testid="tactical-opacity-toggle"
            >
              {opaque ? "OPAQUE" : "FLOATING"}
            </button>
            <button
              type="button"
              onClick={() => { setCategory(null); onClose?.(); }}
              className="flex min-h-11 min-w-11 items-center justify-center rounded text-slate-200 hover:bg-white/10"
              aria-label="Close command panel"
              data-testid="tactical-close"
            >
              <X size={17} />
            </button>
          </div>

          <div className="thin-scroll min-h-0 overflow-y-auto overscroll-contain p-2" style={{ maxHeight: "min(42vh, 340px)" }}>
            {targetFeedback && (
              <div className="mb-2 rounded border border-cyan-400/20 bg-cyan-500/5 px-2 py-1.5 font-mono-g text-[9px] text-cyan-100" role="status" data-testid="tactical-target-feedback">
                {targetFeedback}
              </div>
            )}

            {category === "squad" && (
              <>
                <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-2" aria-label="Select hero">
                  {heroes.map((hero, index) => {
                    const heroClass = C.HERO_CLASSES[hero.cls];
                    const classless = !hero.cls && !!hero.combat;
                    const status = heroStatuses[index] || {};
                    const hp = Number(status.hp ?? hero.combat?.hp ?? hero.hp) || 0;
                    const dead = status.alive === false || hp <= 0;
                    const name = classless ? hero.identity?.name || "Classless Hero" : heroClass?.name || hero.cls;
                    const color = classless ? "#22D3EE" : heroClass?.color;
                    return (
                      <button
                        key={hero.id || index}
                        type="button"
                        onClick={() => onSelectHero?.(index)}
                        className={`flex min-h-14 min-w-[68px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-1 ${
                          selectedHero === index ? "border-fuchsia-300/80 bg-fuchsia-500/15" : "border-white/10 bg-white/[0.03]"
                        } ${dead ? "opacity-50" : ""}`}
                        aria-label={`Select ${name}`}
                        aria-pressed={selectedHero === index}
                        data-testid={`tactical-hero-${index}`}
                      >
                        {classless
                          ? <span className="h-6 w-6 rounded border border-cyan-400/30 bg-black/30" aria-hidden="true" />
                          : <HeroMiniSprite cls={hero.cls} color={color} size="sm" dead={dead} />}
                        <span className="font-mono-g text-[9px] font-bold" style={{ color }}>{name}</span>
                      </button>
                    );
                  })}
                </div>
                {selected && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-white/10 bg-white/[0.03] px-2 py-2 font-mono-g text-[9px] text-slate-200" data-testid="tactical-squad-status">
                      <div>{selectedDead ? "FALLEN" : `${Math.round(selectedHp)}/${Math.round(selectedMaxHp)} HP`}</div>
                      <div className="mt-1 text-slate-400">
                        {selected.manual ? "MANUAL" : "AUTO"}
                        {selectedAp != null ? ` · ${selectedAp} AP` : ""}
                        {selectedSp != null ? ` · ${selectedSp} SP` : ""}
                      </div>
                      {(heroStatuses[selectedHero]?.shield || selected.shield) > 0 && (
                        <div className="mt-1 text-cyan-200">SHIELD · {Math.round(heroStatuses[selectedHero]?.shield || selected.shield)}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDetails?.(selectedHero)}
                      className="min-h-11 rounded border border-cyan-400/30 bg-cyan-500/5 px-2 font-mono-g text-[9px] font-bold text-cyan-100"
                      data-testid="tactical-details"
                    >
                      DETAILS
                    </button>
                    {selectedDead && (
                      <NeonButton
                        color="magenta"
                        className="col-span-2 !min-h-11 !text-[9px]"
                        onClick={() => onRevive?.(selectedHero)}
                        disabled={gold < reviveCost}
                        data-testid="tactical-revive"
                      >
                        <Heart size={13} /> REVIVE · {reviveCost}G
                      </NeonButton>
                    )}
                  </div>
                )}
                {!selected && <p className="font-mono-g text-[9px] text-slate-300">Choose a hero to inspect HP, AP, status, and detailed controls.</p>}
              </>
            )}

            {category === "tactics" && (
              selected ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <NeonButton color="cyan" active={!isManual} className="!min-h-11 !text-[9px]" onClick={() => onAuto?.(selectedHero)} data-testid="tactical-auto">
                      <Eye size={13} /> AUTO
                    </NeonButton>
                    <NeonButton color="magenta" active={isManual} className="!min-h-11 !text-[9px]" onClick={() => onManual?.(selectedHero)} data-testid="tactical-manual">
                      <Crosshair size={13} /> MANUAL
                    </NeonButton>
                    <button
                      type="button"
                      onClick={() => onCommandMode?.("move")}
                      className="min-h-11 rounded border border-cyan-400/30 bg-cyan-500/5 font-mono-g text-[9px] font-bold text-cyan-100"
                      data-testid="tactical-move"
                    >
                      <Move size={13} className="mr-1 inline" /> DESTINATION
                    </button>
                    <button
                      type="button"
                      onClick={() => onRally?.(selectedHero)}
                      className="min-h-11 rounded border border-green-400/30 bg-green-500/5 font-mono-g text-[9px] font-bold text-green-100"
                      data-testid="tactical-rally"
                    >
                      <UsersRound size={13} className="mr-1 inline" /> RALLY SQUAD
                    </button>
                    <button
                      type="button"
                      onClick={() => onRetreat?.(selectedHero)}
                      className="col-span-2 min-h-11 rounded border border-rose-400/30 bg-rose-500/5 font-mono-g text-[9px] font-bold text-rose-100"
                      data-testid="tactical-retreat"
                    >
                      <Shield size={13} className="mr-1 inline" /> RETREAT
                    </button>
                  </div>
                  <p className="mt-2 font-mono-g text-[8px] text-slate-400">Destination mode uses the existing battlefield movement rules.</p>
                </>
              ) : <p className="font-mono-g text-[9px] text-slate-300">Select a hero in Squad to issue commands.</p>
            )}

            {category === "combat" && (
              <div className="space-y-2">
                {selected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onCommandMode?.("target")}
                      className="min-h-12 w-full rounded border border-yellow-300/40 bg-yellow-500/10 px-3 text-left font-mono-g text-[10px] font-bold text-yellow-100"
                      data-testid="tactical-target"
                    >
                      <Swords size={15} className="mr-2 inline" /> BASIC ATTACK · SELECT TARGET
                    </button>
                    {commandMode === "target" && targetSelection && (
                      <div className="rounded border border-green-400/25 bg-green-500/5 p-2" data-testid="ranged-target-status" role="status">
                        <div className="mb-1 font-mono-g text-[8px] font-bold text-green-200">
                          {targetSelection.targets.length} VALID · RANGE {targetSelection.range}
                        </div>
                        {targetSelection.targets.map((target) => (
                          <button
                            key={`${target.type}-${target.name}-${target.distance}`}
                            type="button"
                            onClick={() => onSelectRangedTarget?.(target)}
                            aria-label={`Target ${target.name}, ${target.hp} of ${target.maxHp} HP, ${target.distance} range`}
                            className="mt-1 min-h-11 w-full rounded border border-green-400/20 bg-black/20 px-2 text-left font-mono-g text-[9px] text-slate-100"
                            data-testid={`ranged-target-${target.type}`}
                          >
                            {target.name} · {target.hp}/{target.maxHp} HP · {target.distance}
                          </button>
                        ))}
                        {!targetSelection.targets.length && <div className="py-1 font-mono-g text-[8px] text-slate-300">NO VALID TARGETS IN RANGE</div>}
                      </div>
                    )}
                    {commandMode === "target" && (
                      <button
                        type="button"
                        onClick={onCancelTarget}
                        className="min-h-11 w-full rounded border border-white/20 bg-white/5 font-mono-g text-[9px] text-slate-100"
                        data-testid="tactical-cancel-target"
                      >
                        CANCEL TARGETING
                      </button>
                    )}
                  </>
                ) : <p className="font-mono-g text-[9px] text-slate-300">Select a hero in Squad to attack or target an enemy.</p>}
                {blockadeStatus && (
                  <div className="rounded border border-fuchsia-400/20 bg-fuchsia-500/5 p-2" data-testid="guild-blockade-control">
                    <div className="font-mono-g text-[9px] font-bold text-fuchsia-100">GUILD UNIVERSAL BLOCKADE</div>
                    <div className="mb-2 mt-1 font-mono-g text-[8px] text-slate-300">
                      {blockadeStatus.active ? `ACTIVE · ${Math.ceil(blockadeStatus.remainingMs / 1000)}s` :
                        blockadeStatus.cooldownMs > 0 ? `COOLDOWN · ${Math.ceil(blockadeStatus.cooldownMs / 1000)}s` :
                          "Stops enemies at built barricades"}
                    </div>
                    <button
                      type="button"
                      disabled={!blockadeCanActivate || blockadeStatus.active || blockadeStatus.cooldownMs > 0}
                      onClick={onActivateBlockade}
                      className="min-h-11 w-full rounded border border-fuchsia-300/30 bg-fuchsia-500/10 px-2 font-mono-g text-[9px] font-bold text-fuchsia-100 disabled:opacity-50"
                      data-testid="activate-guild-blockade"
                    >
                      {blockadeStatus.active ? "ACTIVE" : blockadeStatus.cooldownMs > 0 ? "WAIT" : `ACTIVATE · ${blockadeCost?.gold || 0}G/${blockadeCost?.stone || 0}S`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {category === "abilities" && (
              selected ? (
                <>
                  {passivePerks.length > 0 && (
                    <div className="mb-2 rounded border border-cyan-400/20 bg-cyan-500/5 p-2" data-testid="tactical-passive-effects">
                      <div className="mb-1 font-mono-g text-[8px] font-bold tracking-wide text-cyan-100">PASSIVE EFFECTS</div>
                      {passivePerks.map((perk) => (
                        <div key={perk.id} className="py-1 font-mono-g text-[8px] text-slate-200">
                          <span className="font-bold text-cyan-100">{perk.name}</span> · {perk.desc}
                        </div>
                      ))}
                    </div>
                  )}
                  {abilityStatus.length ? (
                    <div className="grid grid-cols-2 gap-2">
                      {abilityStatus.map((ability) => (
                        <ActionInfo key={ability.id} id={ability.id} description={ability.desc} openId={infoId} onToggle={setInfoId}>
                          <button
                            type="button"
                            disabled={ability.cooldown > 0 || !ability.available || selectedDead}
                            onClick={() => ability.targetMode
                              ? onBeginAbilityTarget?.(selectedHero, ability.id)
                              : onAbility?.(selectedHero, ability.id)}
                            className="min-h-12 w-full rounded border px-2 py-1 text-left font-mono-g text-[9px] disabled:opacity-45"
                            aria-label={`${ability.name}: ${ability.cooldown > 0 ? `cooldown ${ability.cooldown.toFixed(1)} seconds` : ability.available ? "ready" : ability.reason === "target_health" ? "target above health requirement" : ability.reason === "no_target" ? "no valid target" : "unavailable"}`}
                            style={{ borderColor: `${ability.color || "#E879F9"}66`, color: ability.color || "#E879F9", background: `${ability.color || "#E879F9"}10` }}
                            data-testid={`tactical-ability-${ability.id}`}
                          >
                            <span className="block font-bold">{ability.name}</span>
                            <span className="block text-[8px] text-slate-200">
                              {Number.isFinite(ability.damage) ? `${Math.round(ability.damage)} RAW · ` : ""}
                              {Number.isFinite(ability.cooldownSeconds) ? `${ability.cooldownSeconds}s CD · ` : ""}
                              {Number.isFinite(ability.resourceCost) ? `${ability.resourceCost} COST · ` : ""}
                              {ability.cooldown > 0 ? `${ability.cooldown.toFixed(1)}s` : ability.available ? "READY" : abilityReasonText(ability.reason)}
                              {Number.isFinite(ability.range) ? ` · ${Math.round(ability.range)}R` : ""}
                              {ability.targetMode === "area" && Number.isFinite(ability.radius) ? ` · ${Math.round(ability.radius)}A` : ""}
                            </span>
                          </button>
                        </ActionInfo>
                      ))}
                    </div>
                  ) : <p className="font-mono-g text-[9px] text-slate-300">No unlocked active abilities.</p>}
                </>
              ) : <p className="font-mono-g text-[9px] text-slate-300">Select a hero in Squad to view abilities.</p>
            )}

            {category === "spells" && (
              selected?.cls === "mage" && spellStatus.length ? (
                <>
                  <div className="mb-2 flex items-center justify-between font-mono-g text-[9px] text-violet-100">
                    <span>MAGE SPELLS · LV {Math.max(1, selected.level || 1)}</span>
                    <span>{Math.floor(spellStatus[0]?.mana || 0)}/{Math.floor(spellStatus[0]?.maxMana || 0)} MP</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {spellStatus.map((spell) => {
                      const details = [
                        spell.desc || spell.description,
                        Number.isFinite(spell.range) ? `Range: ${Math.round(spell.range)}` : null,
                        Number.isFinite(spell.radius) ? `Area radius: ${Math.round(spell.radius)}` : spell.effect === "area" ? "Area effect" : null,
                      ].filter(Boolean).join(" · ");
                      return (
                        <ActionInfo key={spell.id} id={spell.id} description={details} openId={infoId} onToggle={setInfoId}>
                          <button
                            type="button"
                            disabled={!spell.available || selectedDead}
                            onClick={() => spell.targetMode
                              ? onBeginSpellTarget?.(selectedHero, spell.id)
                              : onCastSpell?.(selectedHero, spell.id)}
                            className="min-h-12 w-full rounded border px-2 py-1 text-left font-mono-g text-[9px] disabled:opacity-45"
                            aria-label={`Cast ${spell.name}, ${spell.available ? spell.cooldown > 0 ? `cooldown ${spell.cooldown.toFixed(1)} seconds` : "ready" : "unavailable"}`}
                            style={{ borderColor: `${spell.color || "#A855F7"}70`, color: spell.color || "#A855F7", background: `${spell.color || "#A855F7"}10` }}
                            data-testid={`tactical-spell-${spell.id}`}
                          >
                            <span className="block font-bold">{spell.name}</span>
                            <span className="block text-[8px] text-slate-200">
                              {spell.cost} MP · {Number.isFinite(spell.range) ? `${Math.round(spell.range)}R · ` : ""}
                              {spell.cooldown > 0 ? `${spell.cooldown.toFixed(1)}s` : spell.available ? "READY" : "UNAVAILABLE"}
                            </span>
                          </button>
                        </ActionInfo>
                      );
                    })}
                  </div>
                </>
              ) : <p className="font-mono-g text-[9px] text-slate-300">{selected ? "Spells are available to Mage heroes." : "Select a Mage in Squad to view spells."}</p>
            )}
          </div>
        </section>
      )}

      <div className="pointer-events-auto flex w-full max-w-md gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#090b12]/95 p-1 shadow-lg backdrop-blur-md"
        aria-label="Select active hero" data-testid="tactical-hero-selector">
        {heroes.map((hero, index) => {
          const heroClass = C.HERO_CLASSES[hero.cls];
          const classless = !hero.cls && !!hero.combat;
          const status = heroStatuses[index];
          const hp = Math.max(0, Number(status?.hp ?? hero.combat?.hp ?? hero.hp) || 0);
          const maxHp = Math.max(1, Number(status?.maxHp ?? hero.combat?.maxHp ?? hero.maxHp) || 1);
          const alive = status?.alive ?? hp > 0;
          const name = classless ? hero.identity?.name || "Classless Hero" : heroClass?.name || hero.cls;
          const color = classless ? "#22D3EE" : heroClass?.color;
          return (
            <button
              key={hero.id || index}
              type="button"
              disabled={switchDisabled}
              onClick={() => onSelectHero?.(index)}
              aria-label={`Select ${name}, ${Math.round(hp)} of ${Math.round(maxHp)} HP`}
              aria-pressed={selectedHero === index}
              className={`flex min-h-14 min-w-[68px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1 disabled:opacity-50 ${
                selectedHero === index ? "border-fuchsia-300/70 bg-fuchsia-500/10" : "border-transparent bg-white/[0.02]"
              } ${alive ? "" : "opacity-50"}`}
              data-testid={`battle-active-hero-${index}`}
            >
              <span className="flex items-center gap-1">
                {classless
                  ? <span className="h-6 w-6 rounded border border-cyan-400/30 bg-black/30" aria-label={hero.appearance?.id ? `Appearance ${hero.appearance.id}` : "Appearance not selected"} />
                  : <HeroMiniSprite cls={hero.cls} color={color} size="sm" dead={!alive} />}
                <span className="font-mono-g text-[8px] font-bold" style={{ color }}>{name}</span>
              </span>
              <span className="w-full text-center font-mono-g text-[8px] text-slate-200">{Math.round(hp)}/{Math.round(maxHp)} HP</span>
              <span className="h-1 w-full overflow-hidden rounded bg-white/10">
                <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, hp / maxHp * 100))}%`, background: color }} />
              </span>
            </button>
          );
        })}
      </div>

      <nav
        className="pointer-events-auto grid w-full max-w-md grid-cols-5 gap-1 rounded-xl border border-white/10 bg-[#090b12]/95 p-1 shadow-lg backdrop-blur-md"
        aria-label="Combat command categories"
        data-testid="tactical-category-dock"
      >
        {CATEGORIES.map(({ id, label, Icon, color }) => {
          const active = panelOpen && category === id;
          const activeColors = {
            cyan: "border-cyan-300/70 bg-cyan-400/10 text-cyan-100",
            yellow: "border-yellow-300/70 bg-yellow-400/10 text-yellow-100",
            fuchsia: "border-fuchsia-300/70 bg-fuchsia-400/10 text-fuchsia-100",
            violet: "border-violet-300/70 bg-violet-400/10 text-violet-100",
            green: "border-green-300/70 bg-green-400/10 text-green-100",
          };
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => toggleCategory(id)}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 font-mono-g text-[8px] font-bold disabled:opacity-50 ${
                active ? activeColors[color] : "border-transparent bg-white/[0.02] text-slate-200 hover:bg-white/[0.07]"
              }`}
              aria-label={`${active ? "Close" : "Open"} ${label}`}
              aria-pressed={active}
              data-testid={`tactical-category-${id}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
