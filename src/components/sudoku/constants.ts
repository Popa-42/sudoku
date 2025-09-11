// /src/components/sudoku/constants.ts
import { ColorName } from "@/types";

export const SEL_COLOR_VAR = "[--sel:theme(colors.blue.300)] dark:[--sel:theme(colors.blue.800)]" as const;

export const CORNER_POS_ORDER_ALL = ["tl", "tr", "bl", "br", "tc", "rc", "bc", "lc", "cc"] as const;
export const CORNER_POS_CLASSES: Record<(typeof CORNER_POS_ORDER_ALL)[number], string> = {
  tl: "absolute top-1 left-1 translate-x-0.5 translate-y-0.5",
  tr: "absolute top-1 right-1 -translate-x-0.5 translate-y-0.5",
  bl: "absolute bottom-1 left-1 translate-x-0.5 -translate-y-0.5",
  br: "absolute bottom-1 right-1 -translate-x-0.5 -translate-y-0.5",
  tc: "absolute top-1 left-1/2 -translate-x-1/2 translate-y-0.5",
  rc: "absolute right-1 top-1/2 -translate-y-1/2 -translate-x-0.5",
  bc: "absolute bottom-1 left-1/2 -translate-x-1/2 -translate-y-0.5",
  lc: "absolute left-1 top-1/2 -translate-y-1/2 translate-x-0.5",
  cc: "absolute inset-1 flex items-center justify-center",
};

export const COLOR_BG_CLASS: Record<ColorName, string> = {
  red: "bg-red-200 dark:bg-red-500/40",
  orange: "bg-orange-200 dark:bg-orange-500/40",
  yellow: "bg-yellow-200 dark:bg-yellow-500/40",
  green: "bg-green-200 dark:bg-green-500/40",
  cyan: "bg-cyan-200 dark:bg-cyan-500/40",
  blue: "bg-blue-200 dark:bg-blue-500/40",
  violet: "bg-violet-200 dark:bg-violet-500/40",
  pink: "bg-pink-200 dark:bg-pink-500/40",
  transparent: "bg-transparent",
};

export const COLOR_ORDER: ColorName[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "violet",
  "pink",
  "transparent",
];
