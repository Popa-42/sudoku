// /src/components/sudoku/utils/selection.ts
import { Cell, RectBox } from "@/types";

export function createEmptySelection(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array<boolean>(size).fill(false));
}

export function normalizeSelection(sel: boolean[][] | undefined, size: number): boolean[][] {
  if (!sel || sel.length !== size || sel.some((r) => r.length !== size)) return createEmptySelection(size);
  return sel;
}

export function hasAnySelected(selection: boolean[][]): boolean {
  return selection.some((row) => row.some(Boolean));
}

export function buildSingleSelection(size: number, r: number, c: number): boolean[][] {
  const m = createEmptySelection(size);
  m[r][c] = true;
  return m;
}

export function sameCell(a: Cell, b: Cell) {
  return a[0] === b[0] && a[1] === b[1];
}

export function indexInStack(stack: Cell[], cell: Cell) {
  return stack.findIndex(([r, c]) => r === cell[0] && c === cell[1]);
}

export function pushIfAbsent(stack: Cell[], cell: Cell) {
  if (indexInStack(stack, cell) === -1) stack.push(cell);
  return stack;
}

export function removeFromStack(stack: Cell[], cell: Cell) {
  return stack.filter(([r, c]) => !(r === cell[0] && c === cell[1]));
}

export function stackFromMatrix(mat: boolean[][]): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < mat.length; r++) for (let c = 0; c < mat[r].length; c++) if (mat[r][c]) out.push([r, c]);
  return out;
}

export function computeDefaultBox(size: number): RectBox {
  if (size === 9) return { rows: 3, cols: 3 };
  const r = Math.floor(Math.sqrt(size));
  if (r > 1 && size % r === 0) return { rows: r, cols: size / r };
  return { rows: size, cols: 1 };
}

export function validateRegions(regions: number[][] | undefined, size: number): void {
  if (!regions) return;
  if (regions.length !== size || regions.some((row) => row.length !== size)) {
    throw new Error('Invalid "regions": expected a size×size matrix.');
  }
}
