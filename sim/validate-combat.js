import {constructPlayerState,deterministicComposition} from './state.js';
import {simulateCombat} from './combat.js';
import * as D from './declaration.js';

export function runCombatSelfChecks(){
  const failures=[],build=()=>constructPlayerState({cp:24,family:'balanced',equipmentScenario:'E3',towerComposition:deterministicComposition(24,'balanced'),spPolicy:'neutral',rangedMode:D.RANGED_MODE.A});
  const a=simulateCombat(build(),3,24,null,D.RANGED_MODE.A,{rngSeed:12345}),c=simulateCombat(build(),3,24,null,D.RANGED_MODE.A,{rngSeed:12345});
  if(JSON.stringify(a.metrics)!==JSON.stringify(c.metrics))failures.push({check:'determinism'});
  const s=build(),before=JSON.stringify(s);simulateCombat(s,3,24,null,D.RANGED_MODE.A,{rngSeed:1});if(JSON.stringify(s)!==before)failures.push({check:'state_isolation'});
  const r=simulateCombat(build(),3,24,null,D.RANGED_MODE.A,{rngSeed:2});
  if(!finite(r.metrics))failures.push({check:'finite_metrics'});
  if(r.time>=D.MAX_SIM_TIME)failures.push({check:'termination',time:r.time});
  const src=build();
  for(const [slot,spent] of Object.entries(r.metrics.towerResourceSpent)){const t=src.towers[Number(slot.slice(1))];if(t&&spent>t.maxAmmo+1e-9)failures.push({check:'resource_overdraft',slot,spent})}
  const ih=r.initial.heroes.reduce((a,h)=>a+h.maxHP,0),fh=r.heroes.reduce((a,h)=>a+h.hp,0);
  if(Math.abs(ih-fh-r.metrics.damageToHeroes)>1e-6)failures.push({check:'hero_hp_conservation',expected:ih-fh,actual:r.metrics.damageToHeroes});
  const it=r.initial.towers.reduce((a,t)=>a+t.maxHP,0),ft=r.towers.reduce((a,t)=>a+t.hp,0);
  if(Math.abs(it-ft-r.metrics.damageToTowers)>1e-6)failures.push({check:'tower_hp_conservation',expected:it-ft,actual:r.metrics.damageToTowers});
  if(D.RANGED_MODE.A!=='engine_faithful')failures.push({check:'mode_a_contract'});
  return {pass:failures.length===0,failures};
}
function finite(v){if(typeof v==='number')return Number.isFinite(v);if(v&&typeof v==='object')return Object.values(v).every(finite);return true}
if(import.meta.url===`file://${process.argv[1]}`){const r=runCombatSelfChecks();console.log(JSON.stringify(r,null,2));process.exit(r.pass?0:1)}
