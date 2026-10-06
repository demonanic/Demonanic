import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Backpack, Coins, ShoppingBag, Trash2, Shield, Swords, Wind, Brain, Heart } from "lucide-react";
import { useGame } from "@/context/GameProvider";
import { NeonButton, SectionTitle, TopResourceHUD } from "@/components/ui-kit";
import * as C from "@/game/config";
import {
  EQUIPMENT_RARITIES,
  EQUIPMENT_SLOTS,
  EQUIPMENT_SLOT_LABELS,
  QUICK_SLOT_COUNT,
  QUICK_SLOT_LABELS,
  CLASS_SECONDARY_TYPE,
  ensureShoppe,
  formatEquipmentStats,
  buyShoppeItem,
  sellItem,
  destroyItem,
} from "@/game/equipment";
import { equipHeroItem, unequipHeroItem, heroDerived } from "@/game/logic";

const STAT_ICONS = {
  attack: <Swords size={11} />,
  defense: <Shield size={11} />,
  agility: <Wind size={11} />,
  intelligence: <Brain size={11} />,
  maxHP: <Heart size={11} />,
};

function formatTime(ms) {
  if (ms <= 0) return "refreshing...";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}

function ItemCard({ item, action, actionLabel, secondaryAction, secondaryLabel }) {
  const rarity = EQUIPMENT_RARITIES[item.rarity] || EQUIPMENT_RARITIES.E1;
  return (
    <div className="glass-card rounded-xl p-3 border" style={{ borderColor: rarity.color + "55" }}>
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ color: rarity.color, border: `1px solid ${rarity.color}66`, background: rarity.color + "12", boxShadow: `0 0 12px ${rarity.color}22` }}>
          <span className="font-display font-black">{rarity.short}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-bold text-sm truncate" style={{ color: rarity.color }}>{item.name}</div>
          <div className="font-mono-g text-[9px] text-slate-500">{rarity.name} · {EQUIPMENT_SLOT_LABELS[item.slot] || item.slot}</div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
            {formatEquipmentStats(item.stats).map((stat) => (
              <span key={stat} className="font-mono-g text-[9px] text-slate-300">{stat}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-1.5 mt-2">
        {action && <NeonButton color="cyan" className="!px-2 !py-1 !text-[9px] flex-1" onClick={action}>{actionLabel}</NeonButton>}
        {secondaryAction && <NeonButton color="yellow" className="!px-2 !py-1 !text-[9px]" onClick={secondaryAction}>{secondaryLabel}</NeonButton>}
      </div>
    </div>
  );
}

function EquipmentSlots({ hero, onUnequip }) {
  return (
    <>
    <div className="grid grid-cols-2 gap-1.5">
      {EQUIPMENT_SLOTS.map((slot) => {
        const item = hero.equipment?.[slot];
        const rarity = item ? EQUIPMENT_RARITIES[item.rarity] : null;
        return (
          <div key={slot} className="rounded-lg border border-white/10 bg-black/30 p-2 min-w-0">
            <div className="font-mono-g text-[8px] text-slate-500 uppercase tracking-wider">{EQUIPMENT_SLOT_LABELS[slot]}</div>
            {item ? (
              <>
                <div className="font-mono-g text-[9px] truncate mt-0.5" style={{ color: rarity?.color }}>{item.name}</div>
                <button onClick={() => onUnequip(slot)} className="font-mono-g text-[8px] text-rose-400 mt-1">UNEQUIP</button>
              </>
            ) : (
              <div className="font-mono-g text-[9px] text-slate-700 mt-0.5">EMPTY</div>
            )}
          </div>
        );
      })}
    </div>
    <div className="mt-3">
      <div className="font-mono-g text-[9px] text-slate-500 uppercase tracking-wider mb-1.5">Quick Slots · {QUICK_SLOT_COUNT}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_SLOT_LABELS.map((label, index) => {
          const item = hero.quickSlots?.[index] || null;
          return (
            <div key={label} className="rounded-lg border border-yellow-400/15 bg-black/30 p-2 min-h-[48px]">
              <div className="font-mono-g text-[8px] text-yellow-500/70">{label}</div>
              <div className="font-mono-g text-[9px] truncate mt-0.5 text-slate-600">{item?.name || "EMPTY"}</div>
            </div>
          );
        })}
      </div>
      <div className="font-mono-g text-[8px] text-slate-600 mt-1">Three per-hero quick-use slots. Consumable assignment will populate these slots when consumables are available.</div>
    </div>
    </>
  );
}

export default function Armory() {
  const { state, mutate, setScreen, saveNow } = useGame();
  const [tab, setTab] = useState("vault");
  const [heroIndex, setHeroIndex] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    mutate((s) => { ensureShoppe(s); });
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state?.shoppe?.nextRefreshAt && now >= state.shoppe.nextRefreshAt) {
      mutate((s) => { ensureShoppe(s, now); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, state?.shoppe?.nextRefreshAt]);

  if (!state) return null;

  const heroes = state.heroes || [];
  const hero = heroes[heroIndex] || heroes[0];
  const d = hero ? heroDerived(hero) : null;
  const vault = state.vault || [];
  const shopItems = state.shoppe?.inventory || [];
  const remaining = (state.shoppe?.nextRefreshAt || 0) - now;

  const act = (fn, success, fail = "Cannot complete that action") => {
    mutate((s) => {
      if (!fn(s)) {
        toast.error(fail);
        return;
      }
      if (success) toast.success(success);
    });
  };

  const equip = (item) => {
    if (!hero) return;
    let targetSlot = item.slot;
    if (item.slot === "Ring1" && hero.equipment?.Ring1 && !hero.equipment?.Ring2) targetSlot = "Ring2";
    act((s) => equipHeroItem(s, heroIndex, item.id, targetSlot), `${item.name} equipped`, "Could not equip item");
  };

  const sell = (item) => act((s) => sellItem(s, item.id), `Sold for ${item.sellValue}g`);
  const destroy = (item) => {
    if (!window.confirm(`Destroy ${item.name}? This cannot be undone.`)) return;
    act((s) => destroyItem(s, item.id), "Item destroyed");
  };

  const buy = (index, item) => act(
    (s) => buyShoppeItem(s, index),
    `${item.name} purchased`,
    `Need ${item.buyPrice}g`
  );

  const slotItems = vault;

  return (
    <div className="h-full w-full flex flex-col">
      <header className="p-3 flex items-center gap-2 border-b border-white/10 flex-wrap">
        <NeonButton color="cyan" onClick={() => { saveNow(); setScreen("prep"); }} data-testid="armory-back"><ArrowLeft size={14} /></NeonButton>
        <TopResourceHUD state={state} compact />
        <div className="ml-auto flex items-center gap-2 font-mono-g text-[10px] text-yellow-300">
          <Coins size={13} />{Math.floor(state.gold).toLocaleString()}g
        </div>
      </header>

      <div className="px-3 pt-3">
        <SectionTitle color="magenta">Kingdom Armory</SectionTitle>
        <p className="font-mono-g text-[9px] text-slate-500 mt-1">
          The community Vault receives enemy drops. During preparation, equip, sell, or destroy gear. The Kingdom Shoppe rotates every 2 hours.
        </p>

        <div className="flex gap-1.5 mt-3">
          <button onClick={() => setTab("vault")} className={`flex-1 rounded-lg border p-2 font-mono-g text-[10px] ${tab === "vault" ? "border-cyan-400 bg-cyan-500/15 text-cyan-300" : "border-white/10 text-slate-500"}`} data-testid="armory-vault-tab">
            <Backpack size={12} className="inline mr-1" /> VAULT ({vault.length})
          </button>
          <button onClick={() => setTab("shoppe")} className={`flex-1 rounded-lg border p-2 font-mono-g text-[10px] ${tab === "shoppe" ? "border-yellow-400 bg-yellow-500/15 text-yellow-300" : "border-white/10 text-slate-500"}`} data-testid="armory-shoppe-tab">
            <ShoppingBag size={12} className="inline mr-1" /> SHOPPE ({shopItems.length})
          </button>
        </div>
      </div>

      {tab === "vault" ? (
        <div className="flex-1 overflow-y-auto thin-scroll p-3">
          {hero && (
            <div className="glass-card rounded-xl p-3 mb-3 border border-fuchsia-400/20">
              <div className="flex gap-1.5 mb-2 overflow-x-auto no-scrollbar">
                {heroes.map((h, i) => (
                  <button key={h.id} onClick={() => setHeroIndex(i)}
                    className={`shrink-0 px-2.5 py-1 rounded border font-mono-g text-[9px] ${heroIndex === i ? "border-fuchsia-400 text-fuchsia-300 bg-fuchsia-500/15" : "border-white/10 text-slate-500"}`}>
                    {C.HERO_CLASSES[h.cls].name} L{h.level}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[1.2fr_1fr] gap-2">
                <div>
                  <div className="font-mono-g text-[9px] text-slate-500 mb-1">EQUIPPED · {C.HERO_CLASSES[hero.cls].name}</div>
                  <EquipmentSlots hero={hero} onUnequip={(slot) => act((s) => unequipHeroItem(s, heroIndex, slot), "Item moved to Vault")} />
                  <div className="grid grid-cols-2 gap-1 mt-2">
                    {["attack","defense","agility","intelligence"].map((key) => (
                      <div key={key} className="font-mono-g text-[9px] text-slate-400 bg-black/25 rounded px-2 py-1 flex justify-between">
                        <span className="flex items-center gap-1">{STAT_ICONS[key]} {key.slice(0,3).toUpperCase()}</span>
                        <b className="text-slate-200">{hero.stats[key] + (d?.gear?.[key] || 0)}</b>
                      </div>
                    ))}
                    <div className="font-mono-g text-[9px] text-slate-400 bg-black/25 rounded px-2 py-1 flex justify-between"><span>HP</span><b className="text-slate-200">{Math.round(d?.maxHp || 0)}</b></div>
                    <div className="font-mono-g text-[9px] text-slate-400 bg-black/25 rounded px-2 py-1 flex justify-between"><span>CRIT</span><b className="text-slate-200">{((d?.critChance || C.BASE_CRIT) * 100).toFixed(1)}%</b></div>
                  </div>
                </div>
                <div className="rounded-lg border border-white/5 bg-black/20 p-2">
                  <div className="font-mono-g text-[8px] text-slate-500">SECONDARY IDENTITY</div>
                  <div className="font-mono-g text-[10px] text-slate-300 mt-1">{CLASS_SECONDARY_TYPE[hero.cls] || "Secondary"}</div>
                  <div className="font-mono-g text-[8px] text-slate-600 mt-1">Identity modifiers remain unresolved; current stat package uses the verified neutral secondary template.</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-2">
            <div className="font-mono-g text-[10px] text-slate-400 uppercase tracking-wider">Community Vault</div>
            <span className="font-mono-g text-[9px] text-slate-600">Equip from here during preparation</span>
          </div>

          {slotItems.length === 0 ? (
            <div className="glass-card rounded-xl p-5 text-center font-mono-g text-xs text-slate-600">
              No gear waiting in the Vault. Clear waves to bring equipment home.
            </div>
          ) : (
            <div className="grid gap-2">
              {slotItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  action={() => equip(item)}
                  actionLabel="EQUIP"
                  secondaryAction={() => sell(item)}
                  secondaryLabel={`SELL ${item.sellValue}g`}
                />
              ))}
              {slotItems.map((item) => (
                <div key={`destroy-${item.id}`} className="flex justify-end -mt-1">
                  <button onClick={() => destroy(item)} className="font-mono-g text-[8px] text-rose-500 flex items-center gap-1"><Trash2 size={9} /> DESTROY {item.name}</button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto thin-scroll p-3">
          <div className="glass-card rounded-xl p-3 mb-3 border border-yellow-400/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display font-bold text-yellow-300">Kingdom Shoppe</div>
                <div className="font-mono-g text-[9px] text-slate-500">Random stock rotation · every 2 hours</div>
              </div>
              <div className="font-mono-g text-[10px] text-cyan-300">{formatTime(remaining)}</div>
            </div>
          </div>

          {shopItems.length === 0 ? (
            <div className="glass-card rounded-xl p-5 text-center font-mono-g text-xs text-slate-600">The shelves are empty until the next rotation.</div>
          ) : (
            <div className="grid gap-2">
              {shopItems.map((item, index) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  action={() => buy(index, item)}
                  actionLabel={`BUY ${item.buyPrice}g`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
