import { Heart, Swords, Shield, Sparkles, Crosshair, UsersRound, Coins, X } from "lucide-react";
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
  onDetails,
}) {
  if (!open) return null;

  const selected = selectedHero != null ? heroes[selectedHero] : null;
  const selectedDead = !!selected && selected.hp <= 0;
  const cls = selected ? C.HERO_CLASSES[selected.cls] : null;
  const reviveCost = selected ? C.paidRevivalCost(selected.level) : 0;

  return (
    <div
      className="absolute top-2 right-2 z-50 w-[min(224px,calc(100%-16px))] pointer-events-auto"
      data-testid="tactical-menu"
    >
      <div className="rounded-xl border border-fuchsia-400/35 bg-black/55 backdrop-blur-md shadow-[0_0_24px_rgba(217,70,239,0.14)] overflow-hidden">
        <div className="flex items-center gap-2 px-2.5 py-2 border-b border-white/10">
          <div
            className="w-7 h-7 shrink-0 rounded-md border border-white/20"
            style={{
              background: cls?.color || "#A855F7",
              boxShadow: cls ? `0 0 10px ${cls.color}` : "0 0 8px #A855F7",
            }}
          />
          <div className="min-w-0 flex-1">
            <div
              className="font-mono-g text-[10px] font-bold tracking-wider truncate"
              style={{ color: cls?.color || "#E879F9" }}
            >
              {cls ? cls.name.toUpperCase() : "SELECT HERO"}
            </div>
            <div className="font-mono-g text-[8px] text-slate-400 truncate">
              {cls ? cls.role : "Choose a hero below"}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-500 hover:text-white p-1"
            aria-label="Close tactical menu"
            data-testid="tactical-close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-2 py-1.5 flex gap-1 border-b border-white/10">
          {heroes.map((hero, i) => {
            const heroCls = C.HERO_CLASSES[hero.cls];
            const dead = hero.hp <= 0;
            return (
              <button
                key={hero.id || i}
                onClick={() => onSelectHero(i)}
                className={`flex-1 min-w-0 rounded-md border px-1 py-1.5 transition-all ${
                  selectedHero === i
                    ? "border-fuchsia-300/80 bg-fuchsia-500/15"
                    : "border-white/10 bg-white/[0.02]"
                } ${dead ? "opacity-45" : ""}`}
                data-testid={`tactical-hero-${i}`}
                aria-label={`Select ${heroCls.name}`}
              >
                <div
                  className="mx-auto w-4 h-4 rounded-sm"
                  style={{
                    background: heroCls.color,
                    boxShadow: selectedHero === i ? `0 0 8px ${heroCls.color}` : "none",
                  }}
                />
                <div
                  className="mt-0.5 font-mono-g text-[7px] truncate"
                  style={{ color: heroCls.color }}
                >
                  {heroCls.name}
                </div>
              </button>
            );
          })}
        </div>

        {selected ? (
          <div className="p-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="font-mono-g text-[8px] text-slate-500 uppercase tracking-wider">
                {selectedDead ? "STATUS · FALLEN" : `HP · ${Math.round(selected.hp)}/${Math.round(selected.maxHp)}`}
              </div>
              <div className="flex items-center gap-1 font-mono-g text-[8px] text-yellow-300">
                <Coins size={10} /> {Math.floor(gold)}G
              </div>
            </div>

            {!selectedDead && (
              <div className="mb-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={11} style={{ color: cls.color }} />
                  <span className="font-mono-g text-[9px] font-bold" style={{ color: cls.color }}>
                    {cls.ability.name.toUpperCase()}
                  </span>
                </div>
                <div className="font-mono-g text-[7px] text-slate-500 mt-0.5 leading-tight">
                  {cls.ability.desc}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-1">
              <NeonButton
                color="cyan"
                className="!px-1 !py-1.5 !text-[8px]"
                onClick={() => onAuto(selectedHero)}
                disabled={selectedDead}
                data-testid="tactical-auto"
              >
                <Crosshair size={10} /> AUTO
              </NeonButton>

              <NeonButton
                color="red"
                className="!px-1 !py-1.5 !text-[8px]"
                onClick={() => onRetreat(selectedHero)}
                disabled={selectedDead}
                data-testid="tactical-retreat"
              >
                <Shield size={10} /> RETREAT
              </NeonButton>

              <NeonButton
                color="green"
                className="!px-1 !py-1.5 !text-[8px]"
                onClick={() => onRally(selectedHero)}
                disabled={selectedDead}
                data-testid="tactical-rally"
              >
                <UsersRound size={10} /> RALLY
              </NeonButton>
            </div>

            <div className="grid grid-cols-2 gap-1 mt-1">
              <button
                disabled
                className="rounded border border-fuchsia-400/20 bg-fuchsia-500/5 px-2 py-1.5 font-mono-g text-[8px] text-fuchsia-400/45"
                title="Hero abilities will be connected in the next combat ability pass."
                data-testid="tactical-ability"
              >
                <Sparkles size={10} className="inline mr-1" /> ABILITY
              </button>

              {selectedDead ? (
                <NeonButton
                  color="magenta"
                  className="!px-1 !py-1.5 !text-[8px]"
                  onClick={() => onRevive(selectedHero)}
                  disabled={gold < reviveCost}
                  data-testid="tactical-revive"
                >
                  <Heart size={10} /> REVIVE · {reviveCost}G
                </NeonButton>
              ) : (
                <button
                  onClick={() => onDetails?.(selectedHero)}
                  className="rounded border border-cyan-400/20 bg-cyan-500/5 px-2 py-1.5 font-mono-g text-[8px] text-cyan-300/75 hover:text-cyan-200"
                  data-testid="tactical-details"
                >
                  DETAILS
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="px-2 py-3 text-center font-mono-g text-[8px] text-slate-500">
            Tap a hero to change commands.
          </div>
        )}
      </div>
    </div>
  );
}
