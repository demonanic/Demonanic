import * as C from './constants.js';
import * as D from './declaration.js';
import {constructPlayerState,deterministicComposition} from './state.js';
import {simulateCombat} from './combat.js';
import {validateScenario,validateEquipment} from './validate.js';

export function runCombatMatrix(opts={}){
  const rows=[],trials=opts.trialsPerScenario??3,seedBase=opts.seedBase??1000,modes=opts.includeModeB?[D.RANGED_MODE.A,D.RANGED_MODE.B]:[D.RANGED_MODE.A];
  for(const cp of C.TEST_CPS)for(const family of C.STATE_FAMILIES)for(const equip of C.EQUIPMENT_SCENARIOS)for(const wave of C.TEST_WAVES)for(const mode of modes){
    const state=constructPlayerState({cp,family,equipmentScenario:equip,towerComposition:deterministicComposition(cp,family),spPolicy:'neutral',rangedMode:mode});
    const v=validateScenario(state,cp,wave,null),e=validateEquipment(equip,state);
    if(!v.pass||!e.pass){rows.push({cp,family,equip,wave,mode,discarded:true,failures:[...v.failures,...e.failures]});continue}
    const samples=[];
    for(let i=0;i<trials;i++){const boss=bossForWave(wave);const b=simulateCombat(state,wave,cp,boss,mode,{rngSeed:seedBase+i});samples.push(summarize(b,state))}
    rows.push({cp,family,equip,wave,mode,integrationStatus:equip==='E0'?'ENGINE-FAITHFUL':'ENGINE-FAITHFUL_CURRENT_CATALOG',enemyBehaviorMode:mode===D.RANGED_MODE.A?'MODE_A_ENGINE_FAITHFUL':'MODE_B_PROPOSED',discarded:false,samples});
  }
  return {header:{generatedAt:new Date().toISOString(),simulatorVersion:'combat-v0.1',declaration:'sim/COMBAT_DECLARATION.md',trialsPerScenario:trials,seedBase,primaryGeometrySensitivity:D.GEOMETRY_SENSITIVITY_PRIMARY,primaryMode:'MODE_A_ENGINE_FAITHFUL',modeBAvailable:false,equipmentCritStatus:'ENGINE_INTEGRATED_AND_SIMULATED'},rows};
}
function summarize(b,state){const h=b.metrics;return {heroLevels:state.heroes.map(x=>x.level),towerComposition:state.towers.map(x=>({type:x.type,level:x.level})),victory:h.victory,duration:b.time,heroDeaths:h.heroDeaths,towerDeaths:h.towerDeaths,castleHpRemaining:h.castleHpRemaining,castleHpFraction:h.castleHpFraction,heroDamage:h.heroDamageTotal,towerDamage:h.towerDamageTotal,damageShare:{hero:h.heroDamageTotal/(h.heroDamageTotal+h.towerDamageTotal||1),tower:h.towerDamageTotal/(h.heroDamageTotal+h.towerDamageTotal||1)},enemyKills:h.kills,killsByType:h.killsByType,resourceConsumption:h.towerResourceSpent,primaryFailure:h.failureCause,timedOut:h.timedOut,equipmentCritUnresolved:h.equipmentCritUnresolved};}
function bossForWave(w){return{5:'ThreeHeadedDemon',10:'ImperialNecromancer',15:'NuclearBehemoth'}[w]??null}
if(import.meta.url===`file://${process.argv[1]}`){const trials=Number(process.argv[2]||3);const report=runCombatMatrix({trialsPerScenario:trials});console.log(JSON.stringify(report,null,2))}
