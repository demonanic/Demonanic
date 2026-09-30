import { AuthProvider, useAuth } from "@/context/AuthContext";
import { GameProvider, useGame } from "@/context/GameProvider";
import { Toaster } from "@/components/ui/sonner";
import Login from "@/screens/Login";
import Home from "@/screens/Home";
import SquadSelect from "@/screens/SquadSelect";
import Preparation from "@/screens/Preparation";
import Battle from "@/screens/Battle";
import Results from "@/screens/Results";
import Profile from "@/screens/Profile";

function Splash({ label = "SUMMONING..." }) {
  return (
    <div className="h-full w-full flex items-center justify-center bg-[#0a0b10]">
      <div className="text-center animate-pulse-glow">
        <div className="font-display text-4xl font-black text-fuchsia-500 text-glow-magenta tracking-widest">DEMONANIC</div>
        <div className="font-mono-g text-cyan-400 mt-3 tracking-[0.3em] text-xs">{label}</div>
      </div>
    </div>
  );
}

function GameRouter() {
  const { loading, screen } = useGame();
  if (loading) return <Splash label="LOADING CASTLE..." />;
  switch (screen) {
    case "home": return <Home />;
    case "squad": return <SquadSelect />;
    case "prep": return <Preparation />;
    case "battle": return <Battle />;
    case "results": return <Results />;
    case "profile": return <Profile />;
    default: return <Home />;
  }
}

function Shell() {
  const { user } = useAuth();
  if (user === null) return <Splash />;
  if (!user) return <Login />;
  return (
    <GameProvider>
      <GameRouter />
    </GameProvider>
  );
}

export default function App() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-[#0a0b10] text-slate-100">
      <AuthProvider>
        <Shell />
      </AuthProvider>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
