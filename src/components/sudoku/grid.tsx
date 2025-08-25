import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cn, neighbor } from "@/lib/utils";

type RectBox = { rows: number; cols: number };

type CellSelectInfo = {
  row: number;
  col: number;
  current: [number, number];
  selected: boolean[][];
  event: React.MouseEvent<HTMLDivElement>;
};

type SudokuGridProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number;
  presetGrid?: number[][];
  editedGrid?: number[][];
  pencilGrid?: number[][][];
  currentCell?: [number, number];
  selectedCells?: boolean[][];
  onCellSelect?: (info: CellSelectInfo) => void;
  onSelectionChange?: (selected: boolean[][]) => void;
  onCurrentCellChange?: (cell: [number, number] | undefined) => void;
  box?: RectBox;
  regions?: number[][];
  cellClassName?: string;
  dividerClassName?: string;
};

/* ---------- Pure helpers (exported for reuse/testing) ---------- */
export function createEmptySelection(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array<boolean>(size).fill(false));
}

export function normalizeSelection(sel: boolean[][] | undefined, size: number): boolean[][] {
  if (!sel || sel.length !== size || sel.some((r) => r.length !== size)) {
    return createEmptySelection(size);
  }
  return sel;
}

export function hasAnySelected(selection: boolean[][]): boolean {
  return selection.some((row) => row.some(Boolean));
}

export function buildSingleSelection(size: number, r: number, c: number): boolean[][] {
  const next = createEmptySelection(size);
  next[r][c] = true;
  return next;
}

export function buildToggledSelection(base: boolean[][], r: number, c: number): boolean[][] {
  const next = base.map((row) => row.slice());
  next[r][c] = !next[r][c];
  return next;
}

function computeDefaultBox(size: number): RectBox {
  if (size === 9) return { rows: 3, cols: 3 };
  const r = Math.floor(Math.sqrt(size));
  if (r > 1 && size % r === 0) return { rows: r, cols: size / r };
  return { rows: size, cols: 1 };
}

function validateRegions(regions: number[][] | undefined, size: number): void {
  if (!regions) return;
  if (regions.length !== size || regions.some((row) => row.length !== size)) {
    throw new Error('Invalid "regions": expected a size×size matrix.');
  }
}

/* ---------- Component ---------- */
function SudokuGrid({
  size = 9,
  className,
  presetGrid,
  editedGrid, // kept for API compatibility
  pencilGrid, // kept for API compatibility
  currentCell,
  selectedCells,
  onCellSelect,
  onSelectionChange,
  onCurrentCellChange,
  box,
  regions,
  cellClassName,
  dividerClassName = "border-foreground",
  ...props
}: SudokuGridProps) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Size must be a positive integer.");
  }

  validateRegions(regions, size);

  const emptySelection = useMemo(() => createEmptySelection(size), [size]);
  const [internalCurrent, setInternalCurrent] = useState<[number, number] | undefined>(undefined);
  const [internalSelection, setInternalSelection] = useState<boolean[][]>(emptySelection);
  const [selectionStack, setSelectionStack] = useState<[number, number][]>([]);

  useEffect(() => {
    setInternalSelection(emptySelection);
    setInternalCurrent(undefined);
    setSelectionStack([]);
  }, [size, emptySelection]);

  const activeBox = useMemo(() => box ?? computeDefaultBox(size), [box, size]);

  const getRegionId = useMemo(() => {
    if (regions) {
      return (r: number, c: number) => regions[r][c];
    }
    const colsPerBox = activeBox.cols;
    const rowsPerBox = activeBox.rows;
    const boxesPerRow = Math.ceil(size / colsPerBox);
    return (r: number, c: number) => {
      const boxRow = Math.floor(r / rowsPerBox);
      const boxCol = Math.floor(c / colsPerBox);
      return boxRow * boxesPerRow + boxCol;
    };
  }, [regions, activeBox, size]);

  const current = currentCell ?? internalCurrent;
  const selection = normalizeSelection(selectedCells ?? internalSelection, size);

  useEffect(() => {
    if (!hasAnySelected(selection)) {
      if (!currentCell) setInternalCurrent(undefined);
      setSelectionStack([]);
      onCurrentCellChange?.(undefined);
    }
  }, [selection, currentCell, onCurrentCellChange]);

  const isSelected = useCallback((r: number, c: number) => !!selection?.[r]?.[c], [selection]);
  const isCurrent = useCallback((r: number, c: number) => !!current && current[0] === r && current[1] === c, [current]);

  const cellBorderClasses = useCallback(
    (r: number, c: number) => {
      const base: string[] = ["size-10", "border", "border-foreground", "text-center"];
      if (cellClassName) base.push(cellClassName);

      const thick: string[] = [];
      if (regions) {
        const id = getRegionId(r, c);
        const topChange = r === 0 || getRegionId(r - 1, c) !== id;
        const leftChange = c === 0 || getRegionId(r, c - 1) !== id;
        const rightChange = c === size - 1 || getRegionId(r, c + 1) !== id;
        const bottomChange = r === size - 1 || getRegionId(r + 1, c) !== id;

        if (topChange) thick.push("border-t-2", dividerClassName);
        if (leftChange) thick.push("border-l-2", dividerClassName);
        if (rightChange) thick.push("border-r-2", dividerClassName);
        if (bottomChange) thick.push("border-b-2", dividerClassName);
      } else {
        const topThick = r === 0 || r % activeBox.rows === 0;
        const leftThick = c === 0 || c % activeBox.cols === 0;
        const rightThick = c === size - 1 || (c + 1) % activeBox.cols === 0;
        const bottomThick = r === size - 1 || (r + 1) % activeBox.rows === 0;

        if (topThick) thick.push("border-t-2", dividerClassName);
        if (leftThick) thick.push("border-l-2", dividerClassName);
        if (rightThick) thick.push("border-r-2", dividerClassName);
        if (bottomThick) thick.push("border-b-2", dividerClassName);
      }

      return cn(base.join(" "), thick.join(" "));
    },
    [regions, getRegionId, size, activeBox, dividerClassName, cellClassName],
  );

  const applySelectionChange = useCallback(
    (nextSelection: boolean[][]) => {
      if (!selectedCells) setInternalSelection(nextSelection);
      onSelectionChange?.(nextSelection);
    },
    [selectedCells, onSelectionChange],
  );

  const applyCurrentChange = useCallback(
    (nextCurrent: [number, number] | undefined) => {
      if (!currentCell) setInternalCurrent(nextCurrent);
      onCurrentCellChange?.(nextCurrent);
    },
    [currentCell, onCurrentCellChange],
  );

  const handleClick = useCallback(
    (r: number, c: number) => (event: React.MouseEvent<HTMLDivElement>) => {
      const ctrlMode = event.ctrlKey;
      const alreadySelected = isSelected(r, c);
      const alreadyCurrent = isCurrent(r, c);

      const nextSelection = ctrlMode ? buildToggledSelection(selection, r, c) : buildSingleSelection(size, r, c);

      applySelectionChange(nextSelection);

      let nextStack: [number, number][];
      if (!ctrlMode) {
        nextStack = [[r, c]];
      } else if (alreadySelected) {
        nextStack = selectionStack.filter(([rr, cc]) => rr !== r || cc !== c);
      } else {
        const filtered = selectionStack.filter(([rr, cc]) => rr !== r || cc !== c);
        nextStack = [...filtered, [r, c]];
      }

      let nextCurrent: [number, number] | undefined = current;
      if (!ctrlMode) {
        nextCurrent = [r, c];
      } else if (!alreadySelected) {
        nextCurrent = [r, c];
      } else if (alreadyCurrent) {
        nextCurrent = nextStack[nextStack.length - 1];
      }

      if (!hasAnySelected(nextSelection)) {
        nextCurrent = undefined;
        nextStack = [];
      }

      applyCurrentChange(nextCurrent);
      setSelectionStack(nextStack);

      onCellSelect?.({
        row: r,
        col: c,
        current: (nextCurrent ?? current) as [number, number],
        selected: nextSelection,
        event,
      });
    },
    [
      isSelected,
      isCurrent,
      selection,
      size,
      applySelectionChange,
      selectionStack,
      current,
      applyCurrentChange,
      onCellSelect,
    ],
  );

  return (
    <table role="grid" aria-rowcount={size} aria-colcount={size}>
      <tbody className={cn("border-2 border-foreground", className)} {...props}>
        {Array.from({ length: size }).map((_, r) => (
          <tr key={r} role="row">
            {Array.from({ length: size }).map((_, c) => {
              const top =
                r > 0 &&
                isSelected(
                  neighbor({ row: r, col: c }, -1, 0, size).row,
                  neighbor({ row: r, col: c }, -1, 0, size).col,
                );
              const right =
                c < size - 1 &&
                isSelected(neighbor({ row: r, col: c }, 0, 1, size).row, neighbor({ row: r, col: c }, 0, 1, size).col);
              const bottom =
                r < size - 1 &&
                isSelected(neighbor({ row: r, col: c }, 1, 0, size).row, neighbor({ row: r, col: c }, 1, 0, size).col);
              const left =
                c > 0 &&
                isSelected(
                  neighbor({ row: r, col: c }, 0, -1, size).row,
                  neighbor({ row: r, col: c }, 0, -1, size).col,
                );

              const top_left = c > 0 && r > 0 && !isSelected(r - 1, c - 1) && top && left;
              const top_right = c < size - 1 && r > 0 && !isSelected(r - 1, c + 1) && top && right;
              const bottom_left = c > 0 && r < size - 1 && !isSelected(r + 1, c - 1) && bottom && left;
              const bottom_right = c < size - 1 && r < size - 1 && !isSelected(r + 1, c + 1) && bottom && right;

              return (
                <td key={c} role="gridcell" className={cellBorderClasses(r, c)}>
                  <div
                    onClick={handleClick(r, c)}
                    aria-selected={isSelected(r, c)}
                    className={cn(
                      "relative flex size-full cursor-pointer items-center justify-center select-none",
                      isSelected(r, c) ? "border-4 border-blue-300" : "border-transparent",
                      top && "border-t-0",
                      right && "border-r-0",
                      bottom && "border-b-0",
                      left && "border-l-0",
                      isCurrent(r, c) && "bg-blue-50",
                    )}
                  >
                    {isSelected(r, c) && top_left && (
                      <span className="absolute top-0 left-0 size-[4px] rounded-br-full bg-blue-300" />
                    )}
                    {isSelected(r, c) && top_right && (
                      <span className="absolute top-0 right-0 size-[4px] rounded-bl-full bg-blue-300" />
                    )}
                    {isSelected(r, c) && bottom_left && (
                      <span className="absolute bottom-0 left-0 size-[4px] rounded-tr-full bg-blue-300" />
                    )}
                    {isSelected(r, c) && bottom_right && (
                      <span className="absolute right-0 bottom-0 size-[4px] rounded-tl-full bg-blue-300" />
                    )}
                    {presetGrid?.[r]?.[c] ?? ""}
                  </div>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default SudokuGrid;
