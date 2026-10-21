import {
  activateGuildBlockade, buyBarricade, completeWave, createNewState, freeLife,
  guildBlockadeStatus, guildRepairDefenses, replaceBarricade, surrender,
  upgradeGuildBlockade,
} from "./logic";
import * as C from "./config";

function economyState() {
  const state = createNewState(["knight"]);
  state.gold = 1000;
  state.vaultGold = 900;
  state.buildings = {
    vault: { unlocked: true, hp: 100, maxHp: 100 },
    guild: { unlocked: true, level: 2, hp: 100, maxHp: 100 },
  };
  state.barricades[0] = { hp: 1000, maxHp: 1000 };
  return state;
}

describe("defeat Gold protection and idempotency", () => {
  test("Free Life applies its documented loss to Treasury while protecting a living Vault", () => {
    const state = economyState();
    expect(freeLife(state)).toBe(true);
    expect(state.gold).toBe(300);
    expect(state.vaultGold).toBe(900);
  });

  test("destroyed Vault exposes stored Gold only after Treasury is depleted", () => {
    const state = economyState();
    state.buildings.vault.hp = 0;
    expect(freeLife(state)).toBe(true);
    expect(state.gold).toBe(0);
    expect(state.vaultGold).toBe(570);
  });

  test("repeated Free Life requests cannot deduct twice", () => {
    const state = economyState();
    expect(freeLife(state)).toBe(true);
    const afterFirst = { gold: state.gold, vaultGold: state.vaultGold, stone: state.stone };
    expect(freeLife(state)).toBe(false);
    expect(state).toMatchObject(afterFirst);
  });

  test("surrender charges its wave tax once from exposed Treasury only", () => {
    const state = economyState();
    state.gold = 1000;
    state.vaultGold = 500;
    expect(surrender(state)).toBe(true);
    expect(state.gold).toBe(950);
    expect(state.vaultGold).toBe(500);
    const moraleAfterFirst = state.morale;
    expect(surrender(state)).toBe(false);
    expect(state.gold).toBe(950);
    expect(state.morale).toBe(moraleAfterFirst);
  });

  test("surrender reaches Vault Gold only when the Vault was destroyed", () => {
    const state = economyState();
    state.gold = 0;
    state.vaultGold = 1000;
    state.buildings.vault.hp = 0;
    expect(surrender(state)).toBe(true);
    expect(state.gold).toBe(0);
    expect(state.vaultGold).toBe(950);
  });

  test("migration-compatible surrender marker prevents charging an old surrender again", () => {
    const state = economyState();
    state.surrenderDebtWave = state.wave;
    state.surrenderTaxAppliedWave = state.wave;
    expect(surrender(state)).toBe(false);
    expect(state.gold).toBe(1000);
  });
});

describe("Guild barricade lifecycle and blockade", () => {
  test("barricades can only be installed and replaced through a living Guild", () => {
    const state = economyState();
    expect(buyBarricade(state, 1, C.BARRICADE.maxGold)).toBe(true);
    expect(state.barricades[1]).toEqual({ hp: 1000, maxHp: 1000 });
    const goldAfterInstall = state.gold;
    expect(buyBarricade(state, 1, C.BARRICADE.maxGold)).toBe(false);
    expect(state.gold).toBe(goldAfterInstall);

    state.barricades[1].hp = 0;
    expect(buyBarricade(state, 1, C.BARRICADE.maxGold)).toBe(false);
    expect(replaceBarricade(state, 1)).toBe(true);
    expect(state.barricades[1]).toEqual({ hp: 1000, maxHp: 1000 });
    const goldAfterReplace = state.gold;
    expect(replaceBarricade(state, 1)).toBe(false);
    expect(state.gold).toBe(goldAfterReplace);

    state.buildings.guild.hp = 0;
    expect(buyBarricade(state, 2, C.BARRICADE.maxGold)).toBe(false);
    expect(replaceBarricade(state, 1)).toBe(false);
  });

  test("Guild repairs live damaged barricades but destroyed barricades require paid replacement", () => {
    const state = economyState();
    state.barricades[0].hp = 500;
    state.barricades[1] = { hp: 0, maxHp: 1000 };
    const result = guildRepairDefenses(state);
    expect(result.barricades).toBe(1);
    expect(state.barricades[0].hp).toBe(1000);
    expect(state.barricades[1].hp).toBe(0);
  });

  test("blockade upgrade is Guild-level and resource gated; activation persists cooldown timestamps", () => {
    const state = economyState();
    state.stone = 1000;
    state.buildings.guild.level = 1;
    expect(upgradeGuildBlockade(state)).toBe(false);
    state.buildings.guild.level = C.GUILD_BLOCKADE.requiredGuildLevel;
    expect(upgradeGuildBlockade(state)).toBe(true);
    const goldBefore = state.gold;
    const stoneBefore = state.stone;
    expect(activateGuildBlockade(state, 1000)).toBe(true);
    expect(state.gold).toBe(goldBefore - C.GUILD_BLOCKADE.activationGold);
    expect(state.stone).toBe(stoneBefore - C.GUILD_BLOCKADE.activationStone);
    expect(guildBlockadeStatus(JSON.parse(JSON.stringify(state)), 1001)).toMatchObject({
      unlocked: true, active: true, remainingMs: C.GUILD_BLOCKADE.durationMs - 1,
      cooldownMs: C.GUILD_BLOCKADE.cooldownMs - 1,
    });
    expect(activateGuildBlockade(state, 1001)).toBe(false);
    expect(guildBlockadeStatus(state, 1000 + C.GUILD_BLOCKADE.cooldownMs).cooldownMs).toBe(0);
  });

  test("blockade cannot activate without a surviving barricade or enough supplies", () => {
    const state = economyState();
    state.guildBlockadeLevel = 1;
    state.barricades.forEach((bar) => { bar.hp = 0; bar.maxHp = 1000; });
    expect(activateGuildBlockade(state, 0)).toBe(false);
    state.barricades[0].hp = 100;
    state.gold = 0;
    expect(activateGuildBlockade(state, 0)).toBe(false);
  });
});

describe("retry and victory reward progression", () => {
  test("failed-wave recovery keeps the current wave and only successful completion advances once", () => {
    const state = economyState();
    const failedWave = state.wave;
    expect(freeLife(state)).toBe(true);
    expect(state.wave).toBe(failedWave);
    expect(completeWave(state, failedWave)).toBe(true);
    expect(state.wave).toBe(failedWave + 1);
    expect(completeWave(state, failedWave)).toBe(false);
    expect(state.wave).toBe(failedWave + 1);
  });
});
