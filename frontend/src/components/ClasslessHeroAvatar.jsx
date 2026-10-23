import { HERO_SPRITE_ATLAS } from "../game/heroSprite";

export default function ClasslessHeroAvatar({ className = "", label = "Classless hero" }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-block shrink-0 bg-no-repeat ${className}`}
      style={{
        backgroundImage: `url(${process.env.PUBLIC_URL || ""}${HERO_SPRITE_ATLAS.path})`,
        backgroundSize: "300% 700%",
        backgroundPosition: "0% 0%",
      }}
    />
  );
}
