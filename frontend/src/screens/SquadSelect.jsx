import { useGame } from "../context/GameProvider";
import { NeonButton } from "../components/ui-kit";
import { setClasslessSquad } from "../game/logic";
import { HERO_ROSTER, classlessRecruitCost } from "../game/config";
import { Swords } from "lucide-react";
import ClasslessHeroAvatar from "../components/ClasslessHeroAvatar";

export default function SquadSelect() {
  const { mutate, setScreen, saveNow } = useGame();
  const start = () => {
    let created = false;
    mutate((state) => { created = setClasslessSquad(state); });
    if (!created) return;
    saveNow();
    setScreen("home");
  };

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 50% 20%, rgba(255,0,127,0.25), transparent 55%)" }} />
      <section className="relative w-full max-w-md rounded-xl border border-cyan-400/25 bg-[#080b12]/90 p-5 text-center">
        <h1 className="font-display text-3xl font-black uppercase tracking-wider text-fuchsia-400">Begin Your Journey</h1>
        <p className="mb-5 mt-2 font-mono-g text-xs tracking-wide text-cyan-200">
          One unclassified hero. Build the rest of the squad through play.
        </p>
        <div className="mb-4 rounded-lg border border-white/10 bg-black/35 p-4 text-left">
          <div className="flex items-center gap-3 font-display text-lg font-bold text-cyan-100"><ClasslessHeroAvatar className="h-12 w-12 rounded border border-cyan-400/40 bg-black/30" label="New classless hero sprite" />Hero 1 · Classless Hero</div>
          <div className="mt-1 font-mono-g text-[10px] text-slate-400">300 HP · Shared Strike · Universal progression</div>
          <div className="mt-3 font-mono-g text-[10px] leading-relaxed text-slate-300">
            Recruit up to {HERO_ROSTER.maximumOwned} heroes total. Classless recruitment costs are doubled; your first recruit costs {classlessRecruitCost(HERO_ROSTER.startingHeroes)} gold.
          </div>
        </div>
        <NeonButton color="cyan" className="w-full py-3.5 text-base" onClick={start} data-testid="squad-classless-confirm">
          <Swords size={16} className="mr-2 inline" /> Start with One Hero
        </NeonButton>
        <p className="mt-3 font-mono-g text-[9px] text-slate-500">Appearance stays configurable and is not chosen here.</p>
      </section>
    </div>
  );
}
