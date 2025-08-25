import React from "react";
import { cn } from "@/lib/utils";

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
  pencilGrid?: number[][][]; // 3D array for pencil marks
  currentCell?: [number, number];
  selectedCells?: boolean[][];
  onCellSelect?: (info: CellSelectInfo) => void;
  onSelectionChange?: (selected: boolean[][]) => void;
  onCurrentCellChange?: (cell: [number, number]) => void;
  box?: RectBox;
  regions?: number[][];
  cellClassName?: string;
  dividerClassName?: string;
};

function SudokuGrid({
  size = 9,
  className,
  presetGrid,
  editedGrid,
  pencilGrid,
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

  const emptySel = React.useMemo(() => Array.from({ length: size }, () => Array<boolean>(size).fill(false)), [size]);

  const normalizeSel = (sel?: boolean[][]) => {
    if (!sel || sel.length !== size || sel.some((r) => r.length !== size)) return emptySel;
    return sel;
  };

  const [internalCurrent, setInternalCurrent] = React.useState<[number, number] | undefined>(undefined);
  const [internalSelected, setInternalSelected] = React.useState<boolean[][]>(emptySel);

  React.useEffect(() => {
    setInternalSelected(emptySel);
    setInternalCurrent(undefined);
  }, [size, emptySel]);

  const cur = currentCell ?? internalCurrent;
  const sel = normalizeSel(selectedCells ?? internalSelected);

  const defaultBox = React.useMemo(() => {
    if (size === 9) return { rows: 3, cols: 3 };
    const r = Math.floor(Math.sqrt(size));
    if (r > 1 && size % r === 0) return { rows: r, cols: size / r };
    return { rows: size, cols: 1 };
  }, [size]);

  const activeBox = box ?? defaultBox;

  if (regions) {
    if (regions.length !== size || regions.some((row) => row.length !== size)) {
      throw new Error('Invalid "regions": expected a size×size matrix.');
    }
  }

  const regionIdAt = (r: number, c: number): number => {
    if (regions) return regions[r][c];
    const boxRow = Math.floor(r / activeBox.rows);
    const boxCol = Math.floor(c / activeBox.cols);
    return boxRow * Math.ceil(size / activeBox.cols) + boxCol;
  };

  const cellBorderClasses = (r: number, c: number) => {
    const base = ["size-10", "border", "border-foreground", "text-center"];
    const thick: string[] = [];

    if (regions) {
      const id = regionIdAt(r, c);
      const topChange = r === 0 || regionIdAt(r - 1, c) !== id;
      const leftChange = c === 0 || regionIdAt(r, c - 1) !== id;
      const rightChange = c === size - 1 || regionIdAt(r, c + 1) !== id;
      const bottomChange = r === size - 1 || regionIdAt(r + 1, c) !== id;

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

    if (cellClassName) base.push(cellClassName);
    return cn(base.join(" "), thick.join(" "));
  };

  const buildSingleSelection = (r: number, c: number) => {
    const next = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    next[r][c] = true;
    return next;
  };

  const buildToggledSelection = (r: number, c: number) => {
    const next = sel.map((row) => row.slice());
    next[r][c] = !next[r][c];
    return next;
  };

  const handleClick = (r: number, c: number) => (event: React.MouseEvent<HTMLDivElement>) => {
    const isCtrl = event.ctrlKey; // only Ctrl, no Meta/Cmd
    const nextSel = isCtrl ? buildToggledSelection(r, c) : buildSingleSelection(r, c);

    if (!selectedCells) setInternalSelected(nextSel);
    onSelectionChange?.(nextSel);

    // Do not change current on Ctrl, if clicked cell is already true
    if (!isCtrl || !sel?.[r]?.[c]) {
      const nextCur: [number, number] = [r, c];
      if (!currentCell) setInternalCurrent(nextCur);
      onCurrentCellChange?.(nextCur);
    }

    onCellSelect?.({
      row: r,
      col: c,
      current: (isCtrl ? cur : [r, c]) as [number, number],
      selected: nextSel,
      event,
    });
  };

  const isSelected = (r: number, c: number) => !!sel?.[r]?.[c];
  const isCurrent = (r: number, c: number) => !!cur && cur[0] === r && cur[1] === c;

  return (
    <table role="grid" aria-rowcount={size} aria-colcount={size}>
      <tbody className={cn("border-2 border-foreground", className)} {...props}>
        {Array.from({ length: size }).map((_, r) => (
          <tr key={r} role="row">
            {Array.from({ length: size }).map((_, c) => (
              <td key={c} role="gridcell" className={cellBorderClasses(r, c)}>
                <div
                  onClick={handleClick(r, c)}
                  aria-selected={isSelected(r, c)}
                  className={cn(
                    "flex size-full cursor-pointer items-center justify-center select-none",
                    // selection border on the inner box (keeps outer grid dividers intact)
                    "border-2",
                    isSelected(r, c) ? "border-primary" : "border-transparent",
                    // subtle current highlight
                    isCurrent(r, c) && "bg-yellow-50",
                  )}
                >
                  {presetGrid && presetGrid[r] && presetGrid[r][c] ? presetGrid[r][c] : ""}
                </div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default SudokuGrid;
