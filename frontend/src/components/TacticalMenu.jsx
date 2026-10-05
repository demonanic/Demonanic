import { Heart, Swords, Shield, Sparkles, FlaskConical, Backpack, Coins, X } from "lucide-react";
import { NeonButton } from "@/components/ui-kit";
import * as C from "@/game/config";

export default function TacticalMenu({
  open,
  onClose,
  heroes,
  selectedHero,
  onSelectHero,
  gold = 0,
  onAuto,
  onRetreat,
  onRally,
  onRevive,
}) {
  if (!open) return null;

  const selected = selectedHero != null ? heroes[selectedHero] : null;
  const selectedDead = !!selected && selected.hp <= 0;
  const reviveCost = selected ? C.paidRevivalCost(selected.level) : 0;

  return (
    <div className="absolute inset-x-2 bottom-[148px] z-40" data-testid="tactical-menu">
      <div className="glass rounded-2xl border border-fuchsia-400/40 shadow-[0_0_28px_rgba(217,70,239,0.18)] p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="font-display font-black text-lg text-fuchsia-300 tracking-wider">
              TACTICAL COMMAND
            </div>
            <div className="font-mono-g text-[9px] text-slate-500 tracking-widest">
              SELECT A HERO · ISSUE ORDERS · MANAGE SURVIVAL
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Close tactical menu"
            data-testid="tactical-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {heroes.map((hero, i) => {
            const cls = C.HERO_CLASSES[hero.cls];
            const dead = hero.hp <= 0;
            return (
              <button
                key={hero.id || i}
                onClick={() => onSelectHero(i)}
                className={`rounded-lg border px-1.5 py-2 text-center ${selectedHero === i ? "border-fuchsia-400 bg-fuchsia-500/15" : "border-white/10 bg-black/25"} ${dead ? "opacity-60" : ""}`}
                data-testid={`tactical-hero-${i}`}
              >
                <div
                  className="mx-auto mb-1 w-6 h-6 rounded"
                  style={{ background: cls.color, boxShadow: `0 0 8px ${cls.color}` }}
                />
                <div className="font-mono-g text-[9px]" style={{ color: cls.color }}>
                  {cls.name}
                </div>
                <div className={`font-mono-g text-[8px] ${dead ? "text-rose-400" : "text-slate-500"}`}>
                  {dead ? "FALLEN" : `${Math.round(hero.hp)}/${hero.maxHp}`}
                </div>
              </button>
            );
          })}
        </div>

        {selected ? (
          <>
            <div className="flex items-center justify-between px-2 py-1.5 mb-2 rounded bg-black/30 border border-white/10">
              <span className="font-mono-g text-[10px] text-slate-300">
                SELECTED: <b style={{ color: C.HERO_CLASSES[selected.cls].color }}>{C.HERO_CLASSES[selected.cls].name.toUpperCase()}</b>
              </span>
              <span className="flex items-center gap-1 font-mono-g text-[10px] text-yellow-300">
                <Coins size={11} /> {Math.floor(gold)}G
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <NeonButton
                color="cyan"
                className="!px-2 !py-2 !text-[9px]"
                onClick={() => onAuto(selectedHero)}
                disabled={selectedDead}
                data-testid="tactical-auto"
              >
                AUTO
              </NeonButton>
              <NeonButton
                color="red"
                className="!px-2 !py-2 !text-[9px]"
                onClick={() => onRetreat(selectedHero)}
                disabled={selectedDead}
                data-testid="tactical-retreat"
              >
                <Shield size={11} /> RETREAT
              </NeonButton>
              <NeonButton
                color="green"
                className="!px-2 !py-2 !text-[9px]"
                onClick={() => onRally(selectedHero)}
                disabled={selectedDead}
                data-testid="tactical-rally"
              >
                <Swords size={11} /> RALLY
              </NeonButton>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-1.5">
              <button
                disabled
                className="rounded border border-cyan-400/20 bg-cyan-500/5 px-2 py-2 font-mono-g text-[9px] text-cyan-400/50"
                title="Direct healing will be connected to hero abilities next."
                data-testid="tactical-heal"
              >
                <Heart size={11} className="mx-auto mb-0.5" /> HEAL
              </button>
              <button
                disabled
                className="rounded border border-fuchsia-400/20 bg-fuchsia-500/5 px-2 py-2 font-mono-g text-[9px] text-fuchsia-400/50"
                title="Spell controls will be connected to hero abilities next."
                data-testid="tactical-spells"
              >
                <Sparkles size={11} className="mx-auto mb-0.5" /> SPELLS
              </button>
              <button
                disabled
                className="rounded border border-yellow-400/20 bg-yellow-500/5 px-2 py-2 font-mono-g text-[9px] text-yellow-400/50"
                title="Potion and item inventory will be connected next."
                data-testid="tactical-items"
              >
                <FlaskConical size={11} className="mx-auto mb-0.5" /> POTIONS
              </button>
            </div>

            {selectedDead && (
              <div className="mt-2 rounded-lg border border-rose-500/40 bg-rose-950/20 p-2">
                <div className="font-mono-g text-[9px] text-rose-300 mb-1.5">
                  {C.HERO_CLASSES[selected.cls].name.toUpperCase()} IS FALLEN
                </div>
                <NeonButton
                  color="magenta"
                  className="w-full !py-2 !text-[10px]"
                  onClick={() => onRevive(selectedHero)}
                  disabled={gold < reviveCost}
                  data-testid="tactical-revive"
                >
                  <Heart size={12} /> REVIVE · {reviveCost}G
                </NeonButton>
              </div>
            )}
          </>
        ) : (
          <div className="font-mono-g text-[10px] text-slate-500 text-center py-2">
            Select a hero to issue tactical commands.
          </div>
        )}

        <div className="mt-2 text-center font-mono-g text-[8px] text-slate-600 tracking-wider">
          HEAL · SPELLS · POTIONS ARE RESERVED FOR THE NEXT ABILITY/ITEM PASS
        </div>
      </div>
    </div>
  );
}
