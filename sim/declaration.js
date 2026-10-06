// Executable mirror of sim/COMBAT_DECLARATION.md. Numeric values here must match the frozen contract.
export function requireDecl(name,value,section){if(value==null)throw new Error(`DECLARATION MISSING: ${name} (${section})`);return value}
export const LAYOUT={W:420,H:760,WALL_Y:228,GATE_Y:456,HERO_Y:646,CASTLE_Y:754,LANES:5};
export const SLOT_POS=[{x:60,y:182},{x:360,y:182},{x:60,y:342},{x:360,y:342},{x:210,y:252}];
export const MELEE_RANGE_THRESHOLD=130,HERO_PROJ_SPEED_PHYS=460,HERO_PROJ_SPEED_MAGIC=340;
export function heroAttack(a,l,c){return a+l+(c==='Archer'?l:0)}
export const BASE_CRIT_CHANCE=.05,CRIT_MULTIPLIER=1.75;
export function damageAfterDefense(raw,def){return raw*100/(100+def)}
export const AFFINITY={susceptible:1.25,normal:1,tolerant:.6,resistant:.3,immune:0};
const N='normal',T='tolerant',R='resistant',S='susceptible',I='immune';
export const ENEMY_AFFINITY={
ghost:{knight_melee:N,rouge_melee:N,archer_ranged:N,arcane:N,fire:N,lightning:N,frost:N,dark_soul:T},
slime:{knight_melee:N,rouge_melee:N,archer_ranged:N,arcane:I,fire:N,lightning:R,frost:N,dark_soul:R},
goblin:{knight_melee:N,rouge_melee:N,archer_ranged:N,arcane:N,fire:N,lightning:N,frost:N,dark_soul:N},
skeleton:{knight_melee:N,rouge_melee:N,archer_ranged:N,arcane:N,fire:N,lightning:N,frost:N,dark_soul:N},
orc:{knight_melee:N,rouge_melee:N,archer_ranged:T,arcane:N,fire:N,lightning:N,frost:S,dark_soul:N},
reaper:{knight_melee:T,rouge_melee:N,archer_ranged:T,arcane:N,fire:N,lightning:N,frost:N,dark_soul:R},
darkElf:{knight_melee:N,rouge_melee:N,archer_ranged:T,arcane:N,fire:N,lightning:N,frost:N,dark_soul:S},
warlock:{knight_melee:N,rouge_melee:N,archer_ranged:N,arcane:T,fire:N,lightning:N,frost:N,dark_soul:R},
lieutenant:{knight_melee:N,rouge_melee:N,archer_ranged:N,arcane:N,fire:N,lightning:N,frost:N,dark_soul:N},
demon:{knight_melee:N,rouge_melee:N,archer_ranged:N,arcane:T,fire:R,lightning:N,frost:N,dark_soul:T},
imperialNecromancer:{knight_melee:S,rouge_melee:N,archer_ranged:N,arcane:T,fire:N,lightning:T,frost:T,dark_soul:R},
nuclearBehemoth:{knight_melee:N,rouge_melee:N,archer_ranged:S,arcane:R,fire:N,lightning:R,frost:R,dark_soul:R}};
export const TOWER_TARGETING_MODE={archer:'nearest',catapult:'cluster',wizard:'vulnerable',ballista:'elite_boss'};
export function dodgeChance(a){return Math.max(0,Math.min(.35,.005*a))}
export const DARK_ELF_TOWER_DAMAGE_MULT=1.15,TACTICAL_SPEED_MOD={goblin:1.18,darkElf:1.08,slime:.92,reaper:1.05},TACTICAL_SPEED_DEFAULT=1;
export const LIEUTENANT_AURA_RADIUS=105,LIEUTENANT_AURA_MULT=1.15,RANGED_MODE={A:'engine_faithful',B:'proposed_ranged'};
export const WARLOCK_DRAIN_INTERVAL=4.5,WARLOCK_DRAIN_RANGE=300,WARLOCK_DRAIN_FRACTION=.18,WARLOCK_DRAIN_FLOOR=5,WARLOCK_DEBUFF_DURATION=3,WARLOCK_DEBUFF_MULT=.8;
export const BOSS={initialAbilityCooldown:5,abilityCooldown:6,attackRange:420,skeletonSpawns:2,napalmProjectileSpeed:250,napalmDamageMult:1.3,napalmSplashRadius:68,napalmFalloffMax:.45,lifestealFraction:.5};
export function castleMaxHP(w){return 1000+50*w} export const CASTLE_DAMAGE_MULT=4;
export function enemyCount(w,c){return Math.max(6,Math.round(12+2.5*w+.75*c))} export function hpScale(w,c){return 1+.045*(w-1)+.02*c} export function damageScale(w,c){return 1+.035*(w-1)+.015*c}
export function groups(w){return Math.min(5,Math.max(2,2+Math.floor(w/3)))} export function specialistCap(w,c){return w<=5?.2:Math.min(.5,.2+c*.01)} export function eliteCount(w){return w>=3?1+Math.floor(w/5):0}
export const GROUP_WEIGHTS=[.25,.2,.2,.15,.2],SPAWN_INTERVAL=.55,XP_LIVING_HERO_SHARE=.35,XP_BOSS_TIER=600,GEOMETRY_SENSITIVITY_PRIMARY=1,GEOMETRY_SENSITIVITY_TESTING=[.9,.82],TICK_SIZE=.05,MAX_SIM_TIME=600,TOWER_PROJECTILE_SPEED_PHYS=460,TOWER_PROJECTILE_SPEED_MAGIC=340;
export const UNDERFUNDED={damageMult:.65,fireRateMult:1.25,hpLossPerMin:.04},BARRICADE={collisionDamage:8};
export const ENEMY_CATALOG={ghost:{hp:40,speed:34,damage:6,tier:'basic'},slime:{hp:55,speed:22,damage:8,tier:'basic'},goblin:{hp:45,speed:40,damage:7,tier:'basic'},skeleton:{hp:70,speed:30,damage:12,tier:'specialized'},orc:{hp:120,speed:24,damage:18,tier:'specialized'},reaper:{hp:90,speed:32,damage:15,tier:'specialized',floats:true},darkElf:{hp:105,speed:38,damage:17,tier:'specialized'},warlock:{hp:115,speed:20,damage:13,tier:'specialized'},lieutenant:{hp:300,speed:26,damage:30,tier:'elite'},demon:{hp:2600,speed:20,damage:55,tier:'boss',boss:true},imperialNecromancer:{hp:3000,speed:18,damage:48,tier:'boss',boss:true},nuclearBehemoth:{hp:3400,speed:16,damage:60,tier:'boss',boss:true}};
export const HERO_DEFAULT_CONFIG={Knight:'Offensive Heavy',Rouge:'Blitz Nearest',Mage:'Offensive Spells',Archer:'Sniper (strongest)'};
export const TOWER={archer:{damage:22,fireRate:.9,range:260,baseHp:500,damageType:'archer_ranged',magic:false,splash:0,maxResource:120,shotCost:1},catapult:{damage:70,fireRate:2.2,range:320,baseHp:650,damageType:'knight_melee',magic:false,splash:55,maxResource:30,shotCost:3},wizard:{damage:40,fireRate:1.4,range:240,baseHp:575,damageType:'arcane',magic:true,splash:0,maxResource:100,shotCost:8},ballista:{damage:95,fireRate:1.7,range:380,baseHp:700,damageType:'archer_ranged',magic:false,splash:0,maxResource:40,shotCost:2}};
