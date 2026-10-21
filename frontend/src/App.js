import { AuthProvider, useAuth } from "@/context/AuthContext";
import { GameProvider, useGame } from "@/context/GameProvider";
import { Toaster } from "@/components/ui/sonner";
import LoadingAnimation from "@/components/LoadingAnimation";
import Login from "@/screens/Login";
import Home from "@/screens/Home";
import SquadSelect from "@/screens/SquadSelect";
import Roster from "@/screens/Roster";
import Preparation from "@/screens/Preparation";
import Battle from "@/screens/Battle";
import Results from "@/screens/Results";
import Profile from "@/screens/Profile";
import Armory from "@/screens/Armory";
import LibraryCompletionNotice from "@/components/LibraryCompletionNotice";

function Splash({ label = "SUMMONING..." }) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[#0a0b10]">
      <LoadingAnimation
        type="summoning"
        label={label}
        imageClassName="w-80 h-80"
      />
    </div>
  );
}

function GameRouter() {
  const { loading, loadError, retryLoad, screen, profilePrompt, continueWithLocalBackup, startNewGame } = useGame();
  if (loading) return <Splash label="SUMMONING..." />;
  if (loadError) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0a0b10] p-6 text-center">
        <div className="font-display font-black text-2xl text-rose-400 mb-3">SAVED PROFILE NOT REPLACED</div>
        <p className="font-mono-g text-xs text-slate-400 max-w-sm mb-5">{loadError}</p>
        <button
          className="neon-btn glass-card rounded-lg px-5 py-3 font-mono-g text-xs text-cyan-300"
          onClick={retryLoad}
          data-testid="retry-game-load"
        >
          RETRY LOAD
        </button>
      </div>
    );
  }
  if (profilePrompt) {
    const canContinueLocal = profilePrompt.found && !profilePrompt.invalid && profilePrompt.state;
    const canCreateNew = profilePrompt.kind === "missing" && !profilePrompt.found;
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#0a0b10] p-6 text-center">
        <div className="font-display font-black text-2xl text-rose-400 mb-3">
          {profilePrompt.kind === "missing" ? "SAVED PROFILE NOT FOUND" : "SAVED PROFILE NOT VERIFIED"}
        </div>
        <p className="font-mono-g text-xs text-slate-400 max-w-sm mb-5">
          {canContinueLocal
            ? "A device save is available. Continuing keeps it on this device until the server profile is verified."
            : profilePrompt.invalid
              ? "A device save exists but could not be read. It was left untouched. Retry loading or recover it before starting another game."
              : canCreateNew
                ? "No profile was returned for this account. Starting a new game is an explicit choice and will not replace an existing server profile."
                : profilePrompt.message || "Your game was not replaced. Retry loading your profile."}
        </p>
        {canContinueLocal && (
          <button className="neon-btn glass-card rounded-lg px-5 py-3 mb-3 font-mono-g text-xs text-cyan-300" onClick={continueWithLocalBackup}>
            CONTINUE WITH DEVICE SAVE
          </button>
        )}
        {canCreateNew && (
          <button className="neon-btn glass-card rounded-lg px-5 py-3 mb-3 font-mono-g text-xs text-fuchsia-300" onClick={startNewGame}>
            START NEW GAME
          </button>
        )}
        <button className="neon-btn glass-card rounded-lg px-5 py-3 font-mono-g text-xs text-cyan-300" onClick={retryLoad} data-testid="retry-game-load">
          RETRY LOAD
        </button>
      </div>
    );
  }
  switch (screen) {
    case "home": return <Home />;
    case "squad": return <SquadSelect />;
    case "roster": return <Roster />;
    case "prep": return <Preparation />;
    case "battle": return <Battle />;
    case "results": return <Results />;
    case "profile": return <Profile />;
    case "armory": return <Armory />;
    default: return <Home />;
  }
}

function Shell() {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (!user) return <Login />;
  return (
    <GameProvider user={user}>
      <GameRouter />
      <LibraryCompletionNotice />
    </GameProvider>
  );
}

export default function App() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0b10] text-slate-100">
      <AuthProvider>
        <Shell />
      </AuthProvider>
      <Toaster position="bottom-center" theme="dark" richColors closeButton visibleToasts={1} expand={false} duration={3200} offset="18px" />
    </div>
  );
}
