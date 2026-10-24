import React, { act } from "react";
import { createRoot } from "react-dom/client";
import Armory from "./Armory";
import { createHeroModel } from "../game/heroModel";

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
    vault: [], shoppe: { inventory: [{ id: "shop-item", name: "Neon Blade", rarity: "E1", slot: "Weapon", stats: {}, buyPrice: 25 }], nextRefreshAt: Date.now() + 60000 },
    };
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  test("shared Armory can open Shoppe for a classless starter without reading legacy class fields", () => {
    act(() => root.render(<Armory />));
    expect(container.querySelector('[data-testid="classless-equipment-notice"]')).not.toBeNull();
    act(() => container.querySelector('[data-testid="armory-shoppe-tab"]').click());
    expect(container.textContent).toContain("Neon Blade");
  });
});
