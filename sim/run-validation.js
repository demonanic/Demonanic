import * as C from './constants.js';
import { slotCapacity, deterministicComposition, constructPlayerState } from './state.js';
import { describeEquipment, EQUIPMENT_VERIFICATION_STATUS } from './equipment.js';
import { validateScenario, validateEquipment } from './validate.js';

const CLASS_ORDER = ['Knight','Rouge','Mage','Archer'];

function runConstructionValidation() {
  const rows = [];

  for (const cp of C.TEST_CPS)
  for (const family of C.STATE_FAMILIES)
  for (const equip of C.EQUIPMENT_SCENARIOS) {
    let state = null;
    let constructError = null;

    try {
      state = constructPlayerState({
        cp,
        family,
        equipmentScenario: equip,
        towerComposition: deterministicComposition(cp, family),
        spPolicy: 'neutral',
        rangedMode: 'A',
      });
    } catch (e) {
      constructError = e.message;
    }

    if (constructError) {
      rows.push({ cp, family, equip, pass: false, constructError });
      continue;
    }

    const scenario = validateScenario(state, cp, null, null);
    const equipment = validateEquipment(equip, state);

    const heroCP = state.heroes.reduce((s, h) => s + h.level, 0);
    const towerCP = state.towers.reduce((s, t) => s + t.level, 0);

    rows.push({
      cp, family, equip,
      pass: scenario.pass && equipment.pass,
      scenarioFailures: scenario.failures,
      equipmentFailures: equipment.failures,
      heroLevels: state.heroes.map(h => h.level),
      towerLevels: state.towers.map(t => t.level),
      heroCP,
      towerCP,
      totalCP: heroCP + towerCP,
      towerCap: slotCapacity(cp),
      towerCount: state.towers.length,
      equipmentMeta: Object.fromEntries(
        CLASS_ORDER.map(cls => [cls, describeEquipment(equip, cls)])
      ),
    });
  }

  return {
    header: {
      generatedAt: new Date().toISOString(),
      totalScenarios: rows.length,
      verificationStatus: EQUIPMENT_VERIFICATION_STATUS,
      note: 'Construction-only validation. Combat NOT run.',
    },
    rows,
  };
}

function printReport(result) {
  const { header, rows } = result;
  const line = '='.repeat(110);

  console.log(line);
  console.log('DEMONANIC — CONSTRUCTION VALIDATION REPORT');
  console.log(line);
  console.log(`Generated: ${header.generatedAt}`);
  console.log(`Scenarios: ${header.totalScenarios}`);
  console.log('Combat:    NOT run');
  console.log('');

  const vs = header.verificationStatus;
  console.log('Equipment verification status:');
  console.log(`  Per-slot templates: ${vs.perSlotTemplates}`);
  console.log(`  Ring effects:       ${vs.ringEffects}`);
  console.log(`  Necklace effects:   ${vs.necklaceEffects}`);
  console.log(`  Quick slots:        ${vs.quickSlots.count} (${vs.quickSlots.status})`);
  console.log(`  Secondary weapon:   ${vs.secondaryWeapon.status}`);
  console.log(`    proxy:            ${vs.secondaryWeapon.proxyUsed}`);
  console.log('');

  console.log('CP  Family        Equip  Pass  Heroes         Towers         Cap  CPsum');
  console.log('-'.repeat(110));

  let passCount = 0;

  for (const r of rows) {
    if (r.constructError) {
      console.log(`${String(r.cp).padEnd(3)} ${r.family.padEnd(12)}  ${r.equip}    FAIL  <construct: ${r.constructError}>`);
      continue;
    }

    if (r.pass) passCount++;

    const heroStr = `[${r.heroLevels.join(',')}]`.padEnd(15);
    const towerStr = `[${r.towerLevels.join(',') || '—'}]`.padEnd(14);

    console.log(
      `${String(r.cp).padEnd(3)} ${r.family.padEnd(12)}  ${r.equip}    ` +
      `${(r.pass ? 'PASS' : 'FAIL').padEnd(5)} ${heroStr}  ${towerStr}  ` +
      `${String(r.towerCap).padEnd(4)} ${r.totalCP}`
    );

    for (const f of (r.scenarioFailures ?? []))
      console.log(`       └─ scenario.${f.check}: ${JSON.stringify(f)}`);

    for (const f of (r.equipmentFailures ?? []))
      console.log(`       └─ equipment.${f.check}: ${JSON.stringify(f)}`);
  }

  console.log('');
  console.log(`PASS: ${passCount} / ${rows.length}`);
  console.log(line);

  const checks = {};

  for (const r of rows) {
    for (const f of (r.scenarioFailures ?? []))
      checks['scenario.' + f.check] = (checks['scenario.' + f.check] ?? 0) + 1;

    for (const f of (r.equipmentFailures ?? []))
      checks['equipment.' + f.check] = (checks['equipment.' + f.check] ?? 0) + 1;
  }

  if (Object.keys(checks).length) {
    console.log('Failure counts by check:');
    for (const [k, v] of Object.entries(checks))
      console.log(`  ${k}: ${v}`);
  } else {
    console.log('No failure conditions triggered.');
  }

  return passCount === rows.length;
}

const result = runConstructionValidation();
const ok = printReport(result);
process.exit(ok ? 0 : 1);
