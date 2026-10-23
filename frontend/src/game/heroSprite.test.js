import { HERO_SPRITE_ATLAS, selectHeroSpriteFrame } from "./heroSprite";
import { Engine } from "./engine";
import { createHeroModel } from "./heroModel";
import { createNewState } from "./logic";
import { HERO_WEAPON_ASSETS } from "./heroWeapon";

describe("classless hero sprite animation selection", () => {
  test.each([
    [{ alive: true }, "idle"],
    [{ alive: true, moving: true }, "walk"],
    [{ alive: true, moving: true, running: true }, "run"],
    [{ alive: true, action: "attack" }, "attack"],
    [{ alive: true, action: "sharedStrike" }, "sharedStrike"],
    [{ alive: true, hit: true, action: "attack" }, "hit"],
    [{ alive: false }, "death"],
  ])("selects %s as %s", (state, animation) => {
    expect(selectHeroSpriteFrame(state, 0.1).animation).toBe(animation);
  });

  test("cycles frames inside the correct transparent atlas row", () => {
    const first = selectHeroSpriteFrame({ alive: true, action: "sharedStrike" }, 0);
    const later = selectHeroSpriteFrame({ alive: true, action: "sharedStrike" }, 0.13);
    expect(first.sy).toBe(HERO_SPRITE_ATLAS.animations.sharedStrike * 48);
    expect(first.sx).not.toBe(later.sx);
    expect(first.sw).toBe(48);
    expect(first.sh).toBe(48);
    expect(selectHeroSpriteFrame({ alive: false }, 1).sx).toBeLessThan(144);
  });

  test("Engine draws the body atlas, actual equipped weapon, and persisted color accent", () => {
    const previousImage = global.Image;
    const images = [];
    global.Image = class {
      constructor() {
        this.complete = true;
        this.naturalWidth = 144;
        images.push(this);
      }
      set src(value) { this.path = value; }
    };
    const context = { save: jest.fn(), translate: jest.fn(), rotate: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), restore: jest.fn() };
    const model = createHeroModel({ id: "sprite-draw", identityColor: "#F02DCA" });
    model.equipment = { PrimaryWeapon: { id: "bow-item", slot: "PrimaryWeapon", weaponType: "bow" } };
    const engine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [model] }, { enemies: [], total: 1 });
    engine.ctx = context;
    try {
      engine._drawHeroSprite(engine.heroes[0]);
      const body = images.find((image) => image.path.includes(HERO_SPRITE_ATLAS.path));
      const bow = images.find((image) => image.path.includes(HERO_WEAPON_ASSETS.bow));
      expect(body).toBeTruthy();
      expect(bow).toBeTruthy();
      expect(context.drawImage).toHaveBeenCalledWith(body, 0, 0, 48, 48, -24, -44, 48, 48);
      expect(context.drawImage).toHaveBeenCalledWith(bow, 0, 0, 48, 48, -24, -44, 48, 48);
      expect(context.fillStyle).toBe("#F02DCA");
      expect(context.fillRect).toHaveBeenCalledWith(-1.75, -34, 3.5, 3.5);
    } finally { global.Image = previousImage; }
  });
});
