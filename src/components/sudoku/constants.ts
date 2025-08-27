import { ColorName } from "@/types";

export const SEL_COLOR_VAR = "[--sel:theme(colors.blue.300)]" as const;

export const CORNER_POS_ORDER_ALL = ["tl", "tr", "bl", "br", "tc", "rc", "bc", "lc", "cc"] as const;
export const CORNER_POS_CLASSES: Record<(typeof CORNER_POS_ORDER_ALL)[number], string> = {
  tl: "absolute top-0 left-0 translate-x-0.5 translate-y-0.5",
  tr: "absolute top-0 right-0 -translate-x-0.5 translate-y-0.5",
  bl: "absolute bottom-0 left-0 translate-x-0.5 -translate-y-0.5",
  br: "absolute bottom-0 right-0 -translate-x-0.5 -translate-y-0.5",
  tc: "absolute top-0 left-1/2 -translate-x-1/2 translate-y-0.5",
  rc: "absolute right-0 top-1/2 -translate-y-1/2 -translate-x-0.5",
  bc: "absolute bottom-0 left-1/2 -translate-x-1/2 -translate-y-0.5",
  lc: "absolute left-0 top-1/2 -translate-y-1/2 translate-x-0.5",
  cc: "absolute inset-0 flex items-center justify-center",
};

export const COLOR_BG_CLASS: Record<ColorName, string> = {
  red: "bg-red-200",
  orange: "bg-orange-200",
  yellow: "bg-yellow-200",
  green: "bg-green-200",
  cyan: "bg-cyan-200",
  blue: "bg-blue-200",
  violet: "bg-violet-200",
  pink: "bg-pink-200",
  black: "bg-slate-200",
  transparent: "bg-transparent",
};
