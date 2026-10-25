import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Armory from "./Armory";
import { createHeroModel } from "../game/heroModel";
import { heroDerived } from "../game/logic";

let mockState;
jest.mock("@/context/GameProvider", () => ({ useGame: () => ({ state: mockState, mutate: (fn) => fn(mockState), setScreen: jest.fn(), saveNow: jest.fn() }) }), { virtual: true });
jest.mock("@/components/ui-kit", () => ({ NeonButton: ({ children, ...props }) => <button {...props}>{children}</button>, SectionTitle: ({ children }) => <div>{children}</div>, TopResourceHUD: () => null }), { virtual: true });
jest.mock("@/game/config", () => jest.requireActual("../game/config"), { virtual: true });
jest.mock("@/game/equipment", () => jest.requireActual("../game/equipment"), { virtual: true });
jest.mock("@/game/logic", () => jest.requireActual("../game/logic"), { virtual: true });
jest.mock("@/game/libraryResearch", () => jest.requireActual("../game/libraryResearch"), { virtual: true });
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

describe("classless shared Armory", () => {
  let container, root;
  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockState = {
    heroes: [createHeroModel({ id: "starter", name: "Starter" })], bench: [], gold: 100,
    vault: [{ id: "vault-blade", name: "Vault Blade", rarity: "E1", slot: "PrimaryWeapon", stats: { attack: 2, critDamage: 1 } }],
    shoppe: { inventory: [{ id: "shop-item", name: "Neon Blade", rarity: "E1", slot: "PrimaryWeapon", stats: {}, buyPrice: 25 }], nextRefreshAt: Date.now() + 60000 },
    };
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  test("classless heroes can equip and unequip catalog gear and open Shoppe", () => {
    act(() => root.render(<Armory />));
    expect(container.querySelector('[data-testid="classless-equipment-notice"]')).toBeNull();
    expect(container.textContent).toContain("Vault Blade");
    const hero = mockState.heroes[0];
    expect(container.textContent).toContain("EMPTY");
    const equipButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "EQUIP");
    act(() => equipButton.click());
    expect(hero.equipment.PrimaryWeapon.id).toBe("vault-blade");
    expect(mockState.vault).toHaveLength(0);
    expect(heroDerived(hero).attack).toBe(12);

    act(() => root.render(<Armory />));
    const unequip = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "UNEQUIP");
    act(() => unequip.click());
    expect(hero.equipment.PrimaryWeapon).toBeUndefined();
    expect(mockState.vault[0].id).toBe("vault-blade");

    act(() => container.querySelector('[data-testid="armory-shoppe-tab"]').click());
    expect(container.textContent).toContain("Neon Blade");
  });
});
