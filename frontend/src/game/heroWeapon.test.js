import { createHeroModel } from "./heroModel";
import { createEquipmentItem, equipItem } from "./equipment";
import { getEquippedHeroWeaponAsset, getEquippedHeroWeaponType } from "./heroWeapon";

describe("equipment-driven classless weapon visuals", () => {
  test.each([
    ["sword", 0, "/sprites/weapons/sword.svg"],
    ["bow", 0.4, "/sprites/weapons/bow.svg"],
    ["staff", 0.9, "/sprites/weapons/staff.svg"],
  ])("new %s equipment carries a matching visual identity", (type, random, asset) => {
    const item = createEquipmentItem(1, "PrimaryWeapon", () => random);
    expect(item.weaponType).toBe(type);
    expect(getEquippedHeroWeaponAsset({ equipment: { PrimaryWeapon: item } })).toBe(asset);
  });

  test("an equipment swap immediately changes the rendered weapon mapping", () => {
    const hero = createHeroModel({ id: "weapon-swap" });
    const state = {
      heroes: [hero],
      vault: [
        { id: "equip-sword", slot: "PrimaryWeapon", weaponType: "sword", stats: {} },
        { id: "equip-bow", slot: "PrimaryWeapon", weaponType: "bow", stats: {} },
      ],
    };

    expect(equipItem(state, 0, "equip-sword")).toBe(true);
    expect(getEquippedHeroWeaponType(hero)).toBe("sword");
    expect(equipItem(state, 0, "equip-bow")).toBe(true);
    expect(hero.equipment.PrimaryWeapon.id).toBe("equip-bow");
    expect(getEquippedHeroWeaponType(hero)).toBe("bow");
    expect(state.vault.map((item) => item.id)).toContain("equip-sword");
  });

  test("old item records and classless heroes remain safe without weapon metadata", () => {
    const oldHero = { equipment: { PrimaryWeapon: { slot: "PrimaryWeapon", name: "Neon Blade" } } };
    expect(getEquippedHeroWeaponType(oldHero)).toBe("sword");
    expect(getEquippedHeroWeaponType({ cls: "mage", equipment: { PrimaryWeapon: { slot: "PrimaryWeapon", name: "Void Weapon" } } })).toBe("sword");
    expect(getEquippedHeroWeaponType({ identity: { id: "unarmed" }, equipment: {} })).toBeNull();
    expect(getEquippedHeroWeaponAsset({ equipment: { SecondaryWeapon: { secondaryType: "Wand" } } })).toBe("/sprites/weapons/staff.svg");
  });
});
