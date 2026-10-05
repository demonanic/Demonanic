import { Heart, Shield, Sparkles, Crosshair, UsersRound, Coins, X, Move, Target, Eye } from "lucide-react";
import { NeonButton, HeroMiniSprite } from "@/components/ui-kit";
import * as C from "@/game/config";

export default function TacticalMenu({
  open, onClose, heroes, selectedHero, commandMode = "move",
  onSelectHero, onManual, onAuto, onCommandMode, gold = 0,
  onRetreat, onRally, onRevive, onDetails, opaque = false, onToggleOpaque,
}) {
  if (!open) return null;

  const selected = selectedHero != null ? heroes[selectedHero] : null;
  const selectedDead = !!selected && selected.hp <= 0;
  const cls = selected ? C.HERO_CLASSES[selected.cls] : null;
  const reviveCost = selected ? C.paidRevivalCost(selected.level) : 0;
  const isManual = !!selected?.manual;

  return (
    <div className="absolute top-2 right-2 z-50 w-[min(174px,calc(100%-12px))] pointer-events-auto" data-testid="tactical-menu">
      <div className={"rounded-xl border border-fuchsia-400/40 overflow-hidden shadow-[0_0_24px_rgba(217,70,239,0.18)] " + (opaque ? "bg-[#090b12]" : "bg-black/58 backdrop-blur-md")}>
        <div className="flex items-center gap-2 px-2 py-2 border-b border-white/10">
          <HeroMiniSprite cls={selected?.cls || "mage"} color={cls?.color} size="sm" dead={selectedDead} />
          <div className="min-w-0 flex-1">
            <div className="font-mono-g text-[9px] font-bold tracking-wider truncate" style={{ color: cls?.color || "#E879F9" }}>
              {cls ? cls.name.toUpperCase() : "SELECT HERO"}
            </div>
            <div className="font-mono-g text-[7px] text-slate-500 truncate">{cls ? cls.role : "Choose a hero"}</div>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-white p-1" aria-label="Close tactical menu" data-testid="tactical-close"><X size={14} /></button>
        </div>

        <div className="p-1.5 border-b border-white/10 space-y-1">
          {heroes.map((hero, i) => {
            const heroCls = C.HERO_CLASSES[hero.cls];
            const dead = hero.hp <= 0;
            return (
              <button key={hero.id || i} onClick={() => onSelectHero(i)}
                className={"w-full flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all text-left " +
                  (selectedHero === i ? "border-fuchsia-300/80 bg-fuchsia-500/15" : "border-white/10 bg-white/[0.02]") +
                  (dead ? " opacity-45" : "")}
                data-testid={"tactical-hero-" + i} aria-label={"Select " + heroCls.name}>
                <HeroMiniSprite cls={hero.cls} color={heroCls.color} size="sm" dead={dead} />
                <span className="font-mono-g text-[8px] font-bold flex-1" style={{ color: heroCls.color }}>{heroCls.name}</span>
                {hero.manual && <span className="font-mono-g text-[6px] text-fuchsia-300">MAN</span>}
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="p-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono-g text-[7px] text-slate-500 uppercase">{selectedDead ? "FALLEN" : Math.round(selected.hp) + "/" + Math.round(selected.maxHp) + " HP"}</span>
              <span className="flex items-center gap-1 font-mono-g text-[7px] text-yellow-300"><Coins size={9} />{Math.floor(gold)}G</span>
            </div>

            {!selectedDead && (
              <>
                <div className="grid grid-cols-2 gap-1 mb-1">
                  <NeonButton color="cyan" active={!isManual} className="!px-1 !py-1.5 !text-[8px]" onClick={() => onAuto(selectedHero)} data-testid="tactical-auto">
                    <Eye size={9} /> AUTO
                  </NeonButton>
                  <NeonButton color="magenta" active={isManual} className="!px-1 !py-1.5 !text-[8px]" onClick={() => onManual(selectedHero)} data-testid="tactical-manual">
                    <Crosshair size={9} /> MANUAL
                  </NeonButton>
                </div>

                {isManual && (
                  <>
                    <div className="grid grid-cols-2 gap-1 mb-1">
                      <NeonButton color="cyan" active={commandMode === "move"} className="!px-1 !py-1.5 !text-[8px]" onClick={() => onCommandMode("move")} data-testid="tactical-move">
                        <Move size={9} /> MOVE
                      </NeonButton>
                      <NeonButton color="yellow" active={commandMode === "target"} className="!px-1 !py-1.5 !text-[8px]" onClick={() => onCommandMode("target")} data-testid="tactical-target">
                        <Target size={9} /> TARGET
                      </NeonButton>
                    </div>
                    <div className="font-mono-g text-[6px] text-center text-fuchsia-300/75 mb-1.5">
                      {commandMode === "move" ? "TAP GROUND TO MOVE" : "TAP ENEMY TO TARGET"}
                    </div>
                  </>
                )}

                <div className="grid grid-cols-2 gap-1">
                  <NeonButton color="red" className="!px-1 !py-1.5 !text-[8px]" onClick={() => onRetreat(selectedHero)} data-testid="tactical-retreat"><Shield size={9} /> RETREAT</NeonButton>
                  <NeonButton color="green" className="!px-1 !py-1.5 !text-[8px]" onClick={() => onRally(selectedHero)} data-testid="tactical-rally"><UsersRound size={9} /> RALLY</NeonButton>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-1 mt-1">
              <button disabled className="rounded border border-fuchsia-400/20 bg-fuchsia-500/5 px-1 py-1.5 font-mono-g text-[7px] text-fuchsia-400/45" title="Hero abilities will be connected in the next combat ability pass." data-testid="tactical-ability">
                <Sparkles size={9} className="inline mr-1" /> ABILITY
              </button>
              {selectedDead ? (
                <NeonButton color="magenta" className="!px-1 !py-1.5 !text-[7px]" onClick={() => onRevive(selectedHero)} disabled={gold < reviveCost} data-testid="tactical-revive">
                  <Heart size={9} /> REVIVE
                </NeonButton>
              ) : (
                <button onClick={() => onDetails?.(selectedHero)} className="rounded border border-cyan-400/20 bg-cyan-500/5 px-1 py-1.5 font-mono-g text-[7px] text-cyan-300/75" data-testid="tactical-details">DETAILS</button>
              )}
            </div>

            <button onClick={onToggleOpaque} className="w-full mt-1.5 rounded border border-white/10 bg-white/[0.02] px-1.5 py-1 font-mono-g text-[6px] uppercase tracking-wider text-slate-500 hover:text-slate-300" data-testid="tactical-opacity-toggle">
              HUD: {opaque ? "OPAQUE" : "FLOATING"}
            </button>
          </div>
        ) : (
          <div className="px-2 py-3 text-center font-mono-g text-[7px] text-slate-500">Tap a hero to change commands.</div>
        )}
      </div>
    </div>
  );
}
