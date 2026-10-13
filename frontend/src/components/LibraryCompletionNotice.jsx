import { useGame } from "@/context/GameProvider";
import { resolveLibraryCompletion } from "@/game/libraryResearch";
import { BookOpen, Users, UserRound } from "lucide-react";

export default function LibraryCompletionNotice() {
  const { state, mutate } = useGame();
  const notice = state?.libraryCompletionNotice;
  if (!notice) return null;

  const choose = (choice) => mutate((saved) => {
    resolveLibraryCompletion(saved, choice);
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="library-complete-title" data-testid="library-completion-notice">
      <div className="w-full max-w-sm rounded-xl border border-fuchsia-400/60 bg-[#0b0d18] p-4 shadow-[0_0_35px_rgba(217,70,239,0.22)]">
        <div className="flex items-center gap-2 text-fuchsia-200"><BookOpen size={20} /><span className="font-display font-black text-lg">RESEARCH COMPLETE</span></div>
        <h2 id="library-complete-title" className="mt-3 font-display font-bold text-white">{notice.spellName} is ready</h2>
        <p className="mt-1 font-mono-g text-xs text-slate-300">{notice.mageName} has added the spell to their personal spellbook. Choose where the mage should go next.</p>
        <p className="mt-2 font-mono-g text-[10px] text-slate-500">If a battle is active, this changes the saved lineup for the next battle only.</p>
        <div className="grid gap-2 mt-4">
          <button type="button" onClick={() => choose("return")} className="flex items-center justify-center gap-2 rounded border border-fuchsia-300/60 bg-fuchsia-500/15 px-3 py-3 font-mono-g text-xs font-bold text-fuchsia-100" data-testid="library-return-to-team">
            <Users size={14} /> RETURN TO TEAM
            <span className="font-normal text-fuchsia-200/70">· replaces lowest-level hero</span>
          </button>
          <button type="button" onClick={() => choose("roster")} className="flex items-center justify-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-3 font-mono-g text-xs font-bold text-slate-200" data-testid="library-send-to-roster">
            <UserRound size={14} /> SEND TO ROSTER
          </button>
        </div>
      </div>
    </div>
  );
}
