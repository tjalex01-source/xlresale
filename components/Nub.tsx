import Image from "next/image";

/**
 * Nub, the mascot. One component so poses are typed and swapping the art later
 * is a single file (DESIGN.md → Mascot).
 *
 * Only the poses that have been through background removal are listed here.
 * Adding `clipboard`, `pin`, `wave`, `celebrate` and `peek` is a one-line change
 * once their PNGs land in public/mascot/.
 */
export type NubPose = "shrug" | "point" | "grab" | "lean" | "404";

/**
 * Intrinsic sizes of the trimmed art, so Next can reserve the right box and the
 * page doesn't shift as he loads.
 */
const POSE: Record<NubPose, { src: string; width: number; height: number; alt: string }> = {
  shrug: {
    src: "/mascot/nub-shrug.png",
    width: 802,
    height: 666,
    alt: "Nub shrugging with empty hands",
  },
  point: {
    src: "/mascot/nub-point.png",
    width: 533,
    height: 792,
    alt: "Nub pointing up at a green map pin",
  },
  grab: {
    src: "/mascot/nub-grab.png",
    width: 424,
    height: 809,
    alt: "Nub jumping to grab a box",
  },
  lean: {
    src: "/mascot/nub-lean.png",
    width: 675,
    height: 666,
    alt: "Nub leaning against a pink map pin",
  },
  "404": {
    src: "/mascot/nub-404.png",
    width: 863,
    height: 409,
    alt: "Nub face down on a map",
  },
};

/** float = ambient idle · wave = rocks a few times then stops · hop = one jump. */
export type NubMotion = "none" | "float" | "wave" | "hop";

const MOTION: Record<NubMotion, string> = {
  none: "",
  float: "nub-float",
  wave: "nub-wave",
  hop: "nub-hop",
};

export function Nub({
  pose,
  motion = "none",
  width,
  priority = false,
  className = "",
  decorative = false,
}: {
  pose: NubPose;
  motion?: NubMotion;
  /** Rendered width in px; height follows the art's own ratio. */
  width: number;
  priority?: boolean;
  className?: string;
  /** True when nearby copy already says everything he says. */
  decorative?: boolean;
}) {
  const art = POSE[pose];
  const height = Math.round((art.height / art.width) * width);

  return (
    <Image
      src={art.src}
      alt={decorative ? "" : art.alt}
      aria-hidden={decorative || undefined}
      width={width}
      height={height}
      priority={priority}
      className={`${MOTION[motion]} ${className}`}
      style={{ width, height: "auto" }}
    />
  );
}
