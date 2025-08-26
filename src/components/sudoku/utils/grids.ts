import { Cell } from "@/types";
import { hasAnySelected, stackFromMatrix } from "@/components/sudoku/utils/selection";

export function createNumberGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array<number>(size).fill(0));
}

export function createDigitCube(size: number): number[][][] {
  // second dimension uses indices 1..size
  return Array.from({ length: size }, () => Array.from({ length: size }, () => Array<number>(size + 1).fill(0)));
}

export function selectionTargets(selection: boolean[][], current: Cell | undefined): Cell[] {
  if (hasAnySelected(selection)) return stackFromMatrix(selection);
  return current ? [current] : [];
}
