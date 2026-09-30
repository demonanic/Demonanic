# Demonanic — Playable Web MVP (Vertical Slice)

A neon-synthwave 2D side-view tower-defense / RPG / strategy game where you defend a castle
against advancing enemy hordes using automated towers, barricades, and a controllable four-hero Castle Squad.
This MVP is a shallow-but-complete vertical slice of all three pillars — combat, strategy/preparation, and economy/progression — built strictly to the Demonanic Living Game Design v140 as the authoritative reference.

## Who it's for
- The design team and testers who need a playable prototype to validate the core loop and feel of the locked design.
- Eventually, mobile (Android) players — this web build is the prototype/test version ahead of the production Android game.

## Core features and experience
The MVP delivers one continuous game loop with a thin layer of every major system from the design doc:

- **Layered battlefield & combat.** Enemies advance in real time through defensive layers (outer field → walls/barricades → gates → inner court → keep). Towers auto-fire; when outer defenses are breached the Castle Squad engages; if the squad fails, the castle takes damage. A tactical slowdown ("Battle Clock") triggers for ~10 seconds when you open a hero or tower card mid-combat.
- **Castle Squad (4 heroes).** All four classes — Knight, Rogue, Mage, Archer — each with distinct stats and a starter ability. Heroes earn XP from combat and level up, granting Stat Points (Attack / Defense / Agility / Intelligence) and Ability Perks from class-specific trees.
- **Towers (4+ types).** Persistent towers placed on predefined slots during Preparation. Each can be built, upgraded (choose a stat boost or an ability unlock), maintained, and dismantled. Towers earn XP and level up independently.
- **Barricades.** Purchasable, placeable, repairable obstacles that shape enemy pathing and deal collision damage.
- **Economy.** Three resources — Gold, Food, Stone — generated continuously by Workers (Gold/Stone) and Farmers (Food), including capped offline accrual. Spent on construction, upkeep, repair, recruitment, and upgrades, with exponential workforce cost scaling.
- **Morale system.** A dynamic value driven by combat performance, hero/tower health, and workforce/damage state; affects production and healing, and reaches "Mutiny" at zero.
- **Castle HP & damage.** The castle has its own HP; damage reduces it and degrades workforce efficiency; repair costs Food.
- **Progression & Castle Power.** Castle Power (sum of hero + deployed tower levels) governs tower-slot unlocks (up to 5), wave scaling, and difficulty. A separate account level persists.
- **Enemy behavior.** Enemies advance with imperfect, decaying scouting knowledge, prefer the path of least resistance, and pursue objectives (destroy castle / eliminate defenses / siege resources).
- **Defeat & revival.** One-time free life (retained progression, 30% resources, full hero/tower HP, enemy positions reset); further revivals routed through the monetization abstraction. Surrender carries the specified penalties and Gold tax.
- **Accounts.** Simple username/password login with progression saved server-side, structured so the auth layer can be swapped to Supabase later without touching gameplay.
- **Monetization (mocked).** A provider-independent reward service so gameplay requests rewards through one abstraction. Real providers (Google AdMob for rewarded ads/revives, SpawnTap for offerwall) are stubbed with test/mock implementations — no real SDKs, no secrets in code. Buttons (e.g. "Watch ad to revive," "Recruit hero") call the mock and grant the reward. The web landing page and any future AdSense stay entirely separate from this system.

Systems present but intentionally shallow in the MVP: full ability-tree depth (only Tier 1 perks wired), exhaustive enemy roster/platoon logic, full Horde event, and fine numerical balance — these are staged for later phases per the design doc's OPEN items.

## User flow
1. Player logs in (or creates a local account) and lands on the castle with saved progression, resources, and morale.
2. **Preparation phase:** build/upgrade/dismantle towers on slots, buy and place barricades, configure the four heroes (allocate Stat Points, pick a Tier-1 perk), buy Workers/Farmers, and repair castle/towers.
3. Player starts the wave. **Combat** runs in real time: towers fire, enemies advance through layers, the squad engages when breached. Opening a hero/tower card triggers the tactical slowdown for adjustments.
4. Wave resolves — either enemies are cleared (**Results screen** with XP, resources, morale change) or the castle falls (free life / revival / surrender flow).
5. Loop returns to Preparation with updated Castle Power, unlocked slots, and scaled difficulty.
6. Profile screen shows username, squad/tower config, kill counts, personal bests, and saved resources. A debug/developer panel allows setting resources, CP, wave, and levels and spawning enemies for testing.

## UI/UX feel
Grounded in the provided reference art:
- **Portrait (mobile) battlefield** on a dark grey field, bounded by glowing neon castle walls (bright yellow outer boundary, hot-red inner gate line). Enemies advance from the **top downward** toward the four heroes lined up at the **bottom**.
- **Neon-outline sprite style:** characters and enemies are rendered as vivid glowing neon silhouettes on the muted grey field — multi-colour (magenta, cyan, electric green, yellow, orange, red, purple) glowing ghosts, hooded reaper/wizard skulls, slimes, skeletons, orcs, and goblins, matching the reference sheets. The Demonanic three-headed demon is the signature boss/brand motif.
- **Tower slots** appear as bracket-cornered squares holding a weapon/utility icon (e.g. gear, axe, bow, radiant sun). **Barricades** are hazard-striped bars laid across the field that block/slow enemy movement.
- **HUD** at the bottom shows FOOD + Farmers, GOLD + Workers, a Morale bar, plus Castle HP; an enemy HUD shows count / killed / progressively revealed enemy info.
- **Side config panels** (as sketched) for the selected hero — equipment slots (Helm, Armor, Weapon, Cloak, Ring), core stats (HP/ATK/DEF/AGL/INT), and Attack Config — plus the squad's hero list and the 1–5 tower-slot rack.
- Hero/tower cards open to detailed stats, abilities, config, and XP; opening them visibly slows combat (the tactical Battle Clock).
- Micro-animations on every interaction (hover, card open, tower fire, hit, level-up), neon glow/pulse, staggered entrance reveals, and clear real-time feedback on resources and combat.

## Implementation phases

**Phase 1 — MVP (built now):** The full loop above — Preparation → Wave → Results → Preparation — with 4 heroes, 4+ tower types, barricades, the three-resource economy with workforce and offline accrual, morale, castle HP/damage, Castle Power and tower-slot unlocks, imperfect enemy pathing/objectives, free-life + mocked-revival + surrender, local username/password accounts with server-saved progression (Supabase-ready), the mocked provider-independent monetization service, profile, and debug panel. Tier-1 perks only; single battlefield map; a representative enemy set.

**Phase 2 — Depth:** Full hero/tower ability trees (Tiers 2–3) and layered attack configurations, complete enemy roster with platoons (Lieutenants + Spirit Goons) and richer intelligence/decay, full Horde events, expanded numerical calibration passes, and richer art once references are in.

**Phase 3 — Production readiness:** Swap auth to Supabase, wire real AdMob + SpawnTap adapters behind the existing abstraction (with real credentials/SDKs in the Android build), the separate web landing page (with optional AdSense), account-level meta-progression, and full balance/tuning.

## Assumptions
- **Visual rendering:** the battlefield is rendered as animated neon-outline canvas sprites (glowing units, projectiles, health bars) on a dark grey field with glowing neon walls, matching the provided reference art. Orientation is **portrait** with enemies advancing top→down. Where a specific sprite isn't yet supplied, a stylistically consistent neon placeholder is generated.
- **Auth:** MVP uses a simple username/password account with progression saved to the backend, isolated behind an auth boundary so it can be replaced by Supabase later. "Saved locally to the game" is interpreted as per-account server persistence for this test build.
- **Monetization:** AdMob and SpawnTap are represented only by mock/test adapters; reward buttons work and grant rewards, but no real ad loads and no secrets are stored. Gameplay/reward economics follow the design doc, unchanged by the provider layer.
- **Single map:** one battlefield layout for the MVP; multiple maps are out of scope now.
- **Content breadth:** 4 hero classes and 4 tower types included; enemy variety is a representative subset, not the full roster.
- **OPEN design values:** where the living document leaves a value OPEN but the prototype needs it to run, the smallest reversible placeholder is used and reported afterward — never promoted to a permanent rule.
- **Horde events, full ability trees, layered attack evolution, and platoon AI** are deferred to Phase 2 to keep the MVP a shallow slice of all three pillars.
- **Real-time combat** runs client-side for responsiveness; the backend is the source of truth for saved progression, resources, and account state between waves.
- **No real payments/ads** are processed in the MVP.
