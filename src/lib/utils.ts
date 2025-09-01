// /src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Cell = { row: number; col: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function neighbor(currentCell: Cell, dr: number, dc: number, size?: number): Cell {
  const max = size != null ? size - 1 : Number.POSITIVE_INFINITY;
  return {
    row: clamp(currentCell.row + dr, 0, max),
    col: clamp(currentCell.col + dc, 0, max),
  };
}
