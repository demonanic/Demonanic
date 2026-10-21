import React from "react";

const ANIMATIONS = {
  entering: {
    src: "/loading/entering-the-keep.gif",
    alt: "Entering the Keep animation",
    label: "ENTERING THE KEEP...",
  },
  summoning: {
    src: "/loading/summoning.gif",
    alt: "Summoning animation",
    label: "SUMMONING...",
  },
};

export default function LoadingAnimation({
  type = "summoning",
  label,
  className = "",
  imageClassName = "",
}) {
  const animation = ANIMATIONS[type] || ANIMATIONS.summoning;

  return (
    <div
      className={"flex flex-col items-center justify-center text-center " + className}
      role="status"
      aria-live="polite"
      aria-label={label || animation.label}
    >
      <span className="relative inline-flex">
        <img
          src={animation.src}
          alt=""
          className={"w-56 h-56 object-contain select-none " + imageClassName}
          draggable="false"
        />
        {type === "summoning" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[3%] left-1/2 h-[7%] w-[5%] -translate-x-1/2 bg-[#0a0b10]"
            data-testid="summoning-number-mask"
          />
        )}
      </span>
      <div className="font-mono-g text-cyan-400 mt-2 tracking-[0.3em] text-xs text-glow-cyan">
        {label || animation.label}
      </div>
    </div>
  );
}
