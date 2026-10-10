import { Coins, Mountain, Users, Hammer, ShieldCheck, BookOpen, Store, Castle, Lock } from "lucide-react";

const SITES = [
  { id: "mine", name: "MINE", x: 8, y: 18, color: "#FFE600", shape: "mine", icon: Coins },
  { id: "quarry", name: "QUARRY", x: 68, y: 18, color: "#00F3FF", shape: "quarry", icon: Mountain },
  { id: "tavern", name: "TAVERN", x: 7, y: 57, color: "#FF007F", shape: "tavern", icon: Users },
  { id: "shoppe", name: "SHOPPE", x: 70, y: 57, color: "#A855F7", shape: "shop", icon: Store },
  { id: "academy", name: "ACADEMY", x: 5, y: 38, color: "#39FF14", shape: "academy", icon: ShieldCheck },
  { id: "guild", name: "GUILD", x: 73, y: 38, color: "#FF6600", shape: "guild", icon: Hammer },
  { id: "library", name: "LIBRARY", x: 25, y: 6, color: "#B66CFF", shape: "library", icon: BookOpen },
  { id: "vault", name: "VAULT", x: 49, y: 6, color: "#00F3FF", shape: "vault", icon: Lock },
];

function BuildingGlyph({ site, color, level, hpFrac, selected, locked }) {
  const roof = site.shape === "mine" || site.shape === "quarry" ? "M3 16 L16 4 L29 16" : "M2 13 L16 3 L30 13";
  return (
    <svg viewBox="0 0 32 34" width="100%" height="34" aria-hidden="true">
      <defs>
        <filter id={`glow-${site.id}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="1.7" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" fill={color} fillOpacity=".13" filter={`url(#glow-${site.id})`}>
        <path d={roof} />
        <path d="M5 14 H27 V29 H5 Z" />
        {site.shape === "mine" && <><path d="M9 29 V18 H23 V29" fill="none" /><path d="M11 18 L21 29 M21 18 L11 29" fill="none" /></>}
        {site.shape === "quarry" && <><path d="M9 23 L14 18 L18 23 L22 17" fill="none" /><path d="M10 29 V25 H22 V29" fill="none" /></>}
        {site.shape === "tavern" && <><path d="M10 18 H22 V24 H10 Z" /><path d="M12 14 V18 M20 14 V18" fill="none" /></>}
        {site.shape === "shop" && <><path d="M9 13 L11 9 H21 L23 13" /><path d="M11 18 V27 H21 V18" fill="none" /></>}
        {site.shape === "academy" && <><path d="M16 4 V0 M12 7 L16 3 L20 7" fill="none" /><path d="M12 18 H20 V25 H12 Z" /></>}
        {site.shape === "guild" && <><path d="M10 19 L22 25 M22 19 L10 25" fill="none" /><path d="M16 14 V29" fill="none" /></>}
        {site.shape === "library" && <><path d="M9 18 H23 M9 22 H23 M9 26 H23" fill="none" /><path d="M12 14 V29 M20 14 V29" fill="none" /></>}
        {site.shape === "vault" && <><circle cx="16" cy="22" r="6" fill="none" /><path d="M16 17 V27 M11 22 H21" fill="none" /></>}
        <path d="M14 29 V23 H18 V29" fill="none" />
      </g>
      <rect x="2" y="31" width="28" height="2" rx="1" fill="#02040A" />
      <rect x="2" y="31" width={28 * Math.max(0, Math.min(1, hpFrac))} height="2" rx="1" fill={hpFrac <= .25 ? "#FF0055" : color} />
      {selected && <rect x="0.5" y="1" width="31" height="32" rx="4" fill="none" stroke={color} strokeDasharray="2 2" />}
      <text x="16" y="11" textAnchor="middle" fontSize="6" fill={color} stroke="none">L{level}</text>
    </svg>
  );
}

export default function KingdomMap({ state, selected, onSelect }) {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-cyan-400/30" data-testid="physical-kingdom-map"
      style={{ aspectRatio: "1.15 / 1", minHeight: 285, background: "radial-gradient(ellipse at 50% 48%, rgba(0,243,255,.12), transparent 46%), radial-gradient(ellipse at 50% 50%, #14222a 0%, #0a1119 70%, #070910 100%)" }}>
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(0,243,255,.13) 1px, transparent 1px),linear-gradient(90deg,rgba(0,243,255,.13) 1px,transparent 1px)", backgroundSize: "8% 8%" }} />
      <div className="absolute rounded-full border border-emerald-400/20" style={{ inset: "13% 15%", boxShadow: "inset 0 0 30px rgba(57,255,20,.04)" }} />
      <div className="absolute rounded-full border border-yellow-300/25" style={{ inset: "23% 24%" }} />
      <div className="absolute" style={{ left: "16%", right: "16%", top: "48%", height: 2, background: "linear-gradient(90deg,transparent,#00F3FF,#00F3FF,transparent)", boxShadow: "0 0 8px #00F3FF", opacity: .45 }} />
      <div className="absolute" style={{ top: "17%", bottom: "17%", left: "50%", width: 2, background: "linear-gradient(180deg,transparent,#00F3FF,#00F3FF,transparent)", boxShadow: "0 0 8px #00F3FF", opacity: .3 }} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[31%] h-[39%] rounded-lg border-2 flex flex-col items-center justify-center"
        style={{ borderColor: "#FF2A5F", background: "linear-gradient(135deg,rgba(255,42,95,.18),rgba(168,85,247,.13))", boxShadow: "0 0 22px rgba(255,42,95,.24),inset 0 0 16px rgba(255,42,95,.12)" }}
        data-testid="kingdom-central-castle">
        <Castle size={28} color="#FF2A5F" strokeWidth={1.5} />
        <div className="font-mono-g text-[9px] font-bold text-rose-300 mt-1">KEEP</div>
        <div className="font-mono-g text-[8px] text-slate-300">{Math.round(state.castleHp || 0)}/{Math.round(state.castleMaxHp || 1)}</div>
        <div className="w-4/5 h-1 bg-black/60 rounded overflow-hidden mt-1"><div className="h-full bg-rose-500" style={{ width: `${Math.max(0,Math.min(100,(state.castleHp || 0) / Math.max(1,state.castleMaxHp || 1) * 100))}%` }} /></div>
      </div>
      {SITES.map((site) => {
        const b = state.buildings?.[site.id] || { level: 1, hp: 1000, maxHp: 1000, unlocked: !["academy","guild","library","vault"].includes(site.id) };
        const locked = !b.unlocked;
        const hpFrac = Math.max(0, Math.min(1, (b.hp || 0) / Math.max(1, b.maxHp || 1)));
        const active = selected === site.id;
        return (
          <button key={site.id} type="button" onClick={() => onSelect(site.id)} data-testid={`kingdom-site-${site.id}`}
            aria-label={`${site.name} building, level ${b.level || 1}${locked ? ", locked" : ""}`}
            className="absolute z-10 flex flex-col items-center justify-center rounded-md px-1 py-0.5 transition-transform active:scale-95"
            style={{ left: `${site.x}%`, top: `${site.y}%`, width: "22%", minHeight: 58, border: `1px solid ${active ? site.color : site.color + "66"}`, background: active ? "rgba(255,255,255,.10)" : "rgba(3,7,14,.78)", boxShadow: active ? `0 0 12px ${site.color}55` : "0 0 5px rgba(0,0,0,.6)", opacity: locked ? .72 : 1 }}>
            <div className="w-full max-w-[42px]"><BuildingGlyph site={site} color={site.color} level={b.level || 1} hpFrac={hpFrac} selected={active} locked={locked} /></div>
            <span className="font-mono-g text-[7px] leading-tight font-bold tracking-wide" style={{ color: site.color }}>{site.name}</span>
            {locked && <span className="font-mono-g text-[6px] text-slate-400">LOCKED</span>}
          </button>
        );
      })}
      <div className="absolute bottom-1 left-2 font-mono-g text-[7px] tracking-widest text-cyan-300/50">DEMONANIC · YOUR KINGDOM</div>
    </div>
  );
}
