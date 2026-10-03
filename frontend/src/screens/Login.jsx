import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { NeonButton } from "@/components/ui-kit";
import { Input } from "@/components/ui/input";
import { Loader2, Skull } from "lucide-react";

export default function Login() {
  const { login, register, error } = useAuth();
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);

    if (mode === "login") {
      await login(username, password);
    } else {
      await register(username, password);
    }

    setBusy(false);
  };

  return (
    <div className="h-full w-full flex items-center justify-center relative overflow-hidden scanlines">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgba(255,0,127,0.25), transparent 45%), radial-gradient(circle at 75% 80%, rgba(0,243,255,0.2), transparent 45%)",
        }}
      />

      <div className="relative w-[92%] max-w-sm animate-rise">
        <div className="text-center mb-6">
          <Skull
            className="mx-auto text-fuchsia-500 mb-2"
            size={44}
            style={{ filter: "drop-shadow(0 0 14px #FF007F)" }}
          />
          <h1 className="font-display text-5xl font-black text-fuchsia-500 text-glow-magenta tracking-wider">
            DEMONANIC
          </h1>
          <p className="font-mono-g text-cyan-400 text-xs tracking-[0.35em] mt-1">
            CASTLE DEFENSE · PROTOTYPE
          </p>
        </div>

        <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-4">
          <div className="flex gap-2 mb-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 py-2 rounded-md font-mono-g text-xs uppercase tracking-wide border ${mode === "login" ? "bg-cyan-500 text-black border-cyan-400" : "border-white/10 text-slate-400"}`}
              data-testid="tab-login"
              disabled={busy}
            >
              Log In
            </button>

            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 py-2 rounded-md font-mono-g text-xs uppercase tracking-wide border ${mode === "register" ? "bg-fuchsia-500 text-black border-fuchsia-400" : "border-white/10 text-slate-400"}`}
              data-testid="tab-register"
              disabled={busy}
            >
              Register
            </button>
          </div>

          <div>
            <label className="font-mono-g text-[10px] uppercase tracking-widest text-slate-400">
              Username
            </label>
            <Input
              data-testid="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-black/40 border-cyan-500/30 text-slate-100 font-mono-g mt-1"
              placeholder="commander"
              autoComplete="username"
              disabled={busy}
            />
          </div>

          <div>
            <label className="font-mono-g text-[10px] uppercase tracking-widest text-slate-400">
              Password
            </label>
            <Input
              data-testid="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black/40 border-cyan-500/30 text-slate-100 font-mono-g mt-1"
              placeholder="••••••"
              autoComplete="current-password"
              disabled={busy}
            />
          </div>

          {error && (
            <p className="text-rose-400 text-xs font-mono-g" data-testid="login-error">
              {error}
            </p>
          )}

          <NeonButton
            type="submit"
            color={mode === "login" ? "cyan" : "magenta"}
            className="w-full py-3"
            disabled={busy}
            data-testid="login-submit"
          >
            {busy ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>{mode === "login" ? "Entering the Keep..." : "Forging Account..."}</span>
              </span>
            ) : mode === "login" ? (
              "Enter the Keep"
            ) : (
              "Forge Account"
            )}
          </NeonButton>

          <p className="font-mono-g text-[10px] text-slate-500 text-center">
            Progression saved to your account (Supabase-ready boundary).
          </p>
        </form>
      </div>
    </div>
  );
}
