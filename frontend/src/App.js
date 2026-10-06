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
  const { loading, screen } = useGame();
  if (loading) return <Splash label="SUMMONING..." />;
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
