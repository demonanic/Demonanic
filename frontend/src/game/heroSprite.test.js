import { HERO_SPRITE_ATLAS, selectHeroSpriteFrame } from "./heroSprite";
import { Engine } from "./engine";
import { createHeroModel } from "./heroModel";
import { createNewState } from "./logic";
import { HERO_WEAPON_ASSETS } from "./heroWeapon";
import fs from "fs";
import path from "path";

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
    expect(first.sy).toBe(HERO_SPRITE_ATLAS.animations.sharedStrike * 64);
    expect(first.sx).not.toBe(later.sx);
    expect(first.sw).toBe(64);
    expect(first.sh).toBe(64);
    expect(selectHeroSpriteFrame({ alive: false }, 1).sx).toBeLessThan(192);
  });

  test("the supplied hero atlas differs from the previous recreated artwork", () => {
    const publicRoot = path.join(__dirname, "../../public");
    const supplied = fs.readFileSync(path.join(publicRoot, HERO_SPRITE_ATLAS.path));
    const previous = fs.readFileSync(path.join(publicRoot, "sprites/classless-hero-body-atlas.svg"));
    expect(HERO_SPRITE_ATLAS.path).toBe("/sprites/hero/supplied-classless-hero-atlas.png");
    expect(supplied.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(supplied.readUInt32BE(16)).toBe(192);
    expect(supplied.readUInt32BE(20)).toBe(448);
    expect(supplied.readUInt8(25)).toBe(6); // RGBA frame extraction preserves transparent background.
    expect(supplied.equals(previous)).toBe(false);
  });

  test("Engine draws the supplied atlas and compatible weapon overlay for classless and legacy heroes", () => {
    const previousImage = global.Image;
    const images = [];
    global.Image = class {
      constructor() {
        this.complete = true;
        this.naturalWidth = 192;
        this.naturalHeight = 448;
        images.push(this);
      }
      set src(value) { this.path = value; }
    };
    const makeContext = () => ({ save: jest.fn(), translate: jest.fn(), rotate: jest.fn(), drawImage: jest.fn(), fillRect: jest.fn(), restore: jest.fn() });
    const classlessContext = makeContext();
    const legacyContext = makeContext();
    const classless = createHeroModel({ id: "sprite-classless", identityColor: "#F02DCA" });
    classless.equipment = { PrimaryWeapon: { id: "bow-item", slot: "PrimaryWeapon", weaponType: "bow" } };
    const classlessEngine = new Engine({ getContext: () => null }, { ...createNewState(), heroes: [classless] }, { enemies: [], total: 1 });
    const legacyEngine = new Engine({ getContext: () => null }, createNewState(["archer"]), { enemies: [], total: 1 });
    classlessEngine.ctx = classlessContext;
    legacyEngine.ctx = legacyContext;
    try {
      classlessEngine._drawHeroSprite(classlessEngine.heroes[0]);
      legacyEngine._drawHeroSprite(legacyEngine.heroes[0]);
      const body = images.find((image) => image.path.includes(HERO_SPRITE_ATLAS.path));
      const bow = images.find((image) => image.path.includes(HERO_WEAPON_ASSETS.bow));
      expect(body).toBeTruthy();
      expect(bow).toBeTruthy();
      for (const context of [classlessContext, legacyContext]) {
        expect(context.drawImage).toHaveBeenCalledWith(body, 0, 0, 64, 64, -24, -44, 48, 48);
        expect(context.drawImage).toHaveBeenCalledWith(bow, 0, 0, 48, 48, -24, -44, 48, 48);
        expect(context.fillRect).toHaveBeenCalledWith(-1.75, -34, 3.5, 3.5);
      }
      expect(images.every((image) => !image.path.includes("classless-hero-body-atlas.svg"))).toBe(true);
    } finally { global.Image = previousImage; }
  });
});
