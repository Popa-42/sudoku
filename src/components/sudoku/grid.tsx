import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn, neighbor } from "@/lib/utils";

// Remove the static inset shadow mapping; we'll compute a style.boxShadow instead

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
  pencilMode?: "center" | "corner" | null;
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

// Selection stack pure helpers (top-level, stable identities)
function sameCell(a: [number, number], b: [number, number]) {
  return a[0] === b[0] && a[1] === b[1];
}
function indexInStack(stack: [number, number][], cell: [number, number]) {
  return stack.findIndex(([r, c]) => r === cell[0] && c === cell[1]);
}
function pushIfAbsent(stack: [number, number][], cell: [number, number]) {
  if (indexInStack(stack, cell) === -1) stack.push(cell);
  return stack;
}
function removeFromStack(stack: [number, number][], cell: [number, number]) {
  return stack.filter(([r, c]) => !(r === cell[0] && c === cell[1]));
}
function stackFromMatrix(mat: boolean[][]): [number, number][] {
  const rows = mat.length;
  const cols = rows > 0 ? mat[0].length : 0;
  const out: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (mat[r][c]) out.push([r, c]);
  }
  return out;
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
  editedGrid,
  pencilGrid,
  pencilMode = null,
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLTableSectionElement | null>(null);
  const draggingRef = useRef<boolean>(false);
  const dragRef = useRef<{
    mode: "rect" | "paint-add" | "paint-erase";
    start: [number, number];
    base: boolean[][];
    working: boolean[][];
    visited: Set<number>;
    last?: [number, number];
  } | null>(null);

  // Maintain user-entered values separate from preset grid
  const [userGrid, setUserGrid] = useState<number[][]>(() =>
    Array.from({ length: size }, () => Array<number>(size).fill(0)),
  );
  // Maintain center pencil notes per cell as flags for digits 1..9 (index 1..9 used)
  const [pencils, setPencils] = useState<number[][][]>(() =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => Array<number>(10).fill(0))),
  );
  // Maintain corner pencil notes per cell independently from center notes
  const [cornerPencils, setCornerPencils] = useState<number[][][]>(() =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => Array<number>(10).fill(0))),
  );

  useEffect(() => {
    setInternalSelection(emptySelection);
    setInternalCurrent(undefined);
    setSelectionStack([]);
    setUserGrid(Array.from({ length: size }, () => Array<number>(size).fill(0)));
    setPencils(Array.from({ length: size }, () => Array.from({ length: size }, () => Array<number>(10).fill(0))));
    setCornerPencils(Array.from({ length: size }, () => Array.from({ length: size }, () => Array<number>(10).fill(0))));
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

  // Helper to tell if a cell is a preset (immutable)
  const isPreset = useCallback(
    (r: number, c: number) => {
      const v = presetGrid?.[r]?.[c] ?? 0;
      return v > 0;
    },
    [presetGrid],
  );

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
      const base: string[] = ["size-10", "border", "border-foreground", "text-center", "select-none", "cursor-pointer"];
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

  // Map pointer position to grid cell indices
  const clampIndex = useCallback((v: number, max: number) => Math.max(0, Math.min(max - 1, v)), []);
  const getCellFromPointer = useCallback(
    (e: React.PointerEvent | PointerEvent): [number, number] | undefined => {
      const el = gridRef.current;
      if (!el) return undefined;
      const rect = el.getBoundingClientRect();
      const x = (e as React.PointerEvent).clientX - rect.left;
      const y = (e as React.PointerEvent).clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return undefined;
      const cellW = rect.width / size;
      const cellH = rect.height / size;
      const c = clampIndex(Math.floor(x / cellW), size);
      const r = clampIndex(Math.floor(y / cellH), size);
      return [r, c];
    },
    [size, clampIndex],
  );

  // Pointer-driven selection handlers
  const onPointerDownGrid = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      const cell = getCellFromPointer(e);
      if (!cell) return;
      wrapperRef.current?.focus();
      const [r, c] = cell;

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Fresh start unless Ctrl is held
      const base = isCtrl ? selection.map((row) => row.slice()) : createEmptySelection(size);
      let working = base.map((row) => row.slice());

      // Ctrl overrides Shift
      const mode: "rect" | "paint-add" | "paint-erase" = isCtrl
        ? base[r][c]
          ? "paint-erase"
          : "paint-add"
        : isShift
          ? "rect"
          : "paint-add";

      const info = {
        mode,
        start: [r, c] as [number, number],
        base,
        working,
        visited: new Set<number>(),
        last: [r, c] as [number, number],
      };

      const key = r * size + c;
      info.visited.add(key);

      if (mode === "rect") {
        // Fresh rectangle
        working = createEmptySelection(size);
        working[r][c] = true;
        info.working = working;
        setSelectionStack([[r, c]]);
        applySelectionChange(working);
        applyCurrentChange([r, c]);
      } else if (mode === "paint-add") {
        // Default: fresh paint-add; with Ctrl: additive paint
        working[r][c] = true;
        info.working = working;
        if (isCtrl) {
          setSelectionStack((prev) => pushIfAbsent([...prev], [r, c]));
        } else {
          setSelectionStack([[r, c]]);
        }
        applySelectionChange(working.map((row) => row.slice()));
        applyCurrentChange([r, c]);
      } else {
        // Ctrl paint-erase (does not clear existing selection)
        working[r][c] = false;
        info.working = working;
        setSelectionStack((prev) => removeFromStack(prev, [r, c]));
        applySelectionChange(working.map((row) => row.slice()));
        const prevIdx = indexInStack(selectionStack, [r, c]);
        const before = selectionStack.filter(([rr, cc]) => rr !== r || cc !== c);
        const target = prevIdx > 0 ? selectionStack[prevIdx - 1] : before[before.length - 1];
        applyCurrentChange(target);
      }

      dragRef.current = info;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [selection, size, applySelectionChange, applyCurrentChange, getCellFromPointer, selectionStack],
  );

  const onPointerMoveGrid = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      if (!dragRef.current) return;
      const cell = getCellFromPointer(e);
      if (!cell) return;
      const [r, c] = cell;
      const info = dragRef.current;

      if (info.mode === "rect") {
        const [sr, sc] = info.start;
        const r0 = Math.min(sr, r);
        const r1 = Math.max(sr, r);
        const c0 = Math.min(sc, c);
        const c1 = Math.max(sc, c);
        const working = createEmptySelection(size);
        for (let rr = r0; rr <= r1; rr++) {
          for (let cc = c0; cc <= c1; cc++) working[rr][cc] = true;
        }
        info.working = working;
        info.last = [r, c];
        setSelectionStack(stackFromMatrix(working));
        applySelectionChange(working);
      } else if (info.mode === "paint-add") {
        const key = r * size + c;
        if (!info.visited.has(key)) {
          info.visited.add(key);
          info.working[r][c] = true;
          info.last = [r, c];
          setSelectionStack((prev) => pushIfAbsent([...prev], [r, c]));
          applySelectionChange(info.working.map((row) => row.slice()));
        }
      } else {
        // paint-erase
        const key = r * size + c;
        if (!info.visited.has(key)) {
          info.visited.add(key);
          if (info.working[r][c]) {
            info.working[r][c] = false;
            info.last = [r, c];
            setSelectionStack((prev) => removeFromStack(prev, [r, c]));
            applySelectionChange(info.working.map((row) => row.slice()));
            // if we erased the current cell, move current to last in stack
            if (current && sameCell(current, [r, c])) {
              // compute next based on updated stack value
              setSelectionStack((prev) => {
                const updated = removeFromStack(prev, [r, c]);
                applyCurrentChange(updated.length ? updated[updated.length - 1] : undefined);
                return updated;
              });
            }
          }
        }
      }
    },
    [size, applySelectionChange, getCellFromPointer, current, applyCurrentChange],
  );

  const finishDrag = useCallback(
    (_finalCell?: [number, number]) => {
      if (!dragRef.current) return;
      const info = dragRef.current;
      // For rect/add, set current to the last hovered cell; for erase, keep current as adjusted during drag
      if (info.mode === "rect" || info.mode === "paint-add") {
        applyCurrentChange(info.last ?? info.start);
      }
      dragRef.current = null;
      draggingRef.current = false;
    },
    [applyCurrentChange],
  );

  const onPointerUpGrid = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      const cell = getCellFromPointer(e);
      finishDrag(cell);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
    [finishDrag, getCellFromPointer],
  );

  const onPointerLeaveGrid = useCallback(
    (_e: React.PointerEvent<HTMLTableSectionElement>) => {
      if (!draggingRef.current) return;
      finishDrag(undefined);
    },
    [finishDrag],
  );

  // Apply a value (1..size) or clear (0) to selected cells (or current if none selected), skipping presets
  const applyValueToSelection = useCallback(
    (value: number) => {
      const targets: [number, number][] = [];
      if (hasAnySelected(selection)) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (selection[r][c]) targets.push([r, c]);
          }
        }
      } else if (current) {
        targets.push(current);
      }
      if (targets.length === 0) return;

      setUserGrid((prev) => {
        const next = prev.map((row) => row.slice());
        for (const [r, c] of targets) {
          if (isPreset(r, c)) continue; // don't overwrite presets
          next[r][c] = value > 0 ? value : 0;
        }
        return next;
      });
    },
    [selection, size, current, isPreset],
  );

  // Toggle a center pencil digit (1..9) for selected cells (or current if none), skipping presets
  const togglePencilDigit = useCallback(
    (digit: number) => {
      if (digit < 1 || digit > 9) return;
      const targets: [number, number][] = [];
      if (hasAnySelected(selection)) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (selection[r][c]) targets.push([r, c]);
          }
        }
      } else if (current) {
        targets.push(current);
      }
      if (targets.length === 0) return;

      setPencils((prev) => {
        const next = prev.map((row) => row.map((cell) => cell.slice()));
        for (const [r, c] of targets) {
          if (isPreset(r, c)) continue; // cannot pencil on preset
          next[r][c][digit] = next[r][c][digit] ? 0 : 1;
        }
        return next;
      });
    },
    [selection, size, current, isPreset],
  );

  // Toggle a corner pencil digit (1..9) for selected cells (or current if none), skipping presets
  const toggleCornerDigit = useCallback(
    (digit: number) => {
      if (digit < 1 || digit > 9) return;
      const targets: [number, number][] = [];
      if (hasAnySelected(selection)) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (selection[r][c]) targets.push([r, c]);
          }
        }
      } else if (current) {
        targets.push(current);
      }
      if (targets.length === 0) return;

      setCornerPencils((prev) => {
        const next = prev.map((row) => row.map((cell) => cell.slice()));
        for (const [r, c] of targets) {
          if (isPreset(r, c)) continue; // cannot pencil on preset
          next[r][c][digit] = next[r][c][digit] ? 0 : 1;
        }
        return next;
      });
    },
    [selection, size, current, isPreset],
  );

  // Clear all center pencil notes in selected/current cells, skipping presets
  const clearPencils = useCallback(() => {
    const targets: [number, number][] = [];
    if (hasAnySelected(selection)) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (selection[r][c]) targets.push([r, c]);
        }
      }
    } else if (current) {
      targets.push(current);
    }
    if (targets.length === 0) return;

    setPencils((prev) => {
      const next = prev.map((row) => row.map((cell) => cell.slice()));
      for (const [r, c] of targets) {
        if (isPreset(r, c)) continue;
        next[r][c].fill(0);
      }
      return next;
    });
  }, [selection, size, current, isPreset]);

  // Clear all corner pencil notes in selected/current cells, skipping presets
  const clearCornerPencils = useCallback(() => {
    const targets: [number, number][] = [];
    if (hasAnySelected(selection)) {
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (selection[r][c]) targets.push([r, c]);
        }
      }
    } else if (current) {
      targets.push(current);
    }
    if (targets.length === 0) return;

    setCornerPencils((prev) => {
      const next = prev.map((row) => row.map((cell) => cell.slice()));
      for (const [r, c] of targets) {
        if (isPreset(r, c)) continue;
        next[r][c].fill(0);
      }
      return next;
    });
  }, [selection, size, current, isPreset]);

  // Move current cell by (dr, dc), clamp within bounds; set single selection and stack accordingly
  const moveCurrent = useCallback(
    (dr: number, dc: number) => {
      let base: [number, number] | undefined = current;
      if (!base) {
        if (hasAnySelected(selection)) {
          outer: for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              if (selection[r][c]) {
                base = [r, c];
                break outer;
              }
            }
          }
        } else {
          base = [0, 0];
        }
      }
      const n = neighbor({ row: base![0], col: base![1] }, dr, dc, size);
      const next: [number, number] = [n.row, n.col];
      applyCurrentChange(next);
      const nextSel = buildSingleSelection(size, next[0], next[1]);
      applySelectionChange(nextSel);
      setSelectionStack([next]);
    },
    [current, selection, size, applyCurrentChange, applySelectionChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key;

      // Clear selection with Escape
      if (key === "Escape") {
        e.preventDefault();
        applySelectionChange(createEmptySelection(size));
        applyCurrentChange(undefined);
        setSelectionStack([]);
        return;
      }

      // Arrow navigation
      if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
        e.preventDefault();
        if (key === "ArrowUp") moveCurrent(-1, 0);
        if (key === "ArrowDown") moveCurrent(1, 0);
        if (key === "ArrowLeft") moveCurrent(0, -1);
        if (key === "ArrowRight") moveCurrent(0, 1);
        return;
      }
      // Delete/Backspace or 0 clears
      if (key === "Backspace" || key === "Delete" || key === "0") {
        e.preventDefault();
        if (pencilMode === "center") {
          clearPencils();
        } else if (pencilMode === "corner") {
          clearCornerPencils();
        } else {
          applyValueToSelection(0);
        }
        return;
      }
      // digits 1..9 (numpad included since e.key is the digit character)
      if (/^[1-9]$/.test(key)) {
        const val = parseInt(key, 10);
        if (val >= 1 && val <= Math.min(9, size)) {
          e.preventDefault();
          if (pencilMode === "center") {
            togglePencilDigit(val);
          } else if (pencilMode === "corner") {
            toggleCornerDigit(val);
          } else {
            applyValueToSelection(val);
          }
        }
      }
    },
    [
      applyValueToSelection,
      size,
      pencilMode,
      togglePencilDigit,
      toggleCornerDigit,
      clearPencils,
      clearCornerPencils,
      moveCurrent,
      applyCurrentChange,
      applySelectionChange,
    ],
  );

  return (
    <div ref={wrapperRef} tabIndex={0} onKeyDown={onKeyDown} className="outline-none focus:outline-none">
      <table role="grid" aria-rowcount={size} aria-colcount={size}>
        <tbody
          ref={gridRef}
          className={cn("border-2 border-foreground", className)}
          onPointerDown={onPointerDownGrid}
          onPointerMove={onPointerMoveGrid}
          onPointerUp={onPointerUpGrid}
          onPointerLeave={onPointerLeaveGrid}
          {...props}
        >
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
                  isSelected(
                    neighbor({ row: r, col: c }, 0, 1, size).row,
                    neighbor({ row: r, col: c }, 0, 1, size).col,
                  );
                const bottom =
                  r < size - 1 &&
                  isSelected(
                    neighbor({ row: r, col: c }, 1, 0, size).row,
                    neighbor({ row: r, col: c }, 1, 0, size).col,
                  );
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

                // Build inline boxShadow for selected cells; use CSS var --sel for color set via Tailwind arbitrary property
                const boxShadowParts: string[] = [];
                const selected = isSelected(r, c);
                if (selected) {
                  if (!left) boxShadowParts.push("inset 4px 0 0 0 var(--sel)");
                  if (!right) boxShadowParts.push("inset -4px 0 0 0 var(--sel)");
                  if (!top) boxShadowParts.push("inset 0 4px 0 0 var(--sel)");
                  if (!bottom) boxShadowParts.push("inset 0 -4px 0 0 var(--sel)");
                }
                const boxShadow = boxShadowParts.join(", ");

                const presetVal = presetGrid?.[r]?.[c] ?? 0;
                const userVal = userGrid?.[r]?.[c] ?? 0;
                const displayVal = presetVal > 0 ? presetVal : userVal > 0 ? userVal : "";

                // Build center and corner pencil candidates when no main value is shown and cell is not preset
                const centerFlags = !presetVal && !userVal ? pencils?.[r]?.[c] : undefined;
                const cornerFlags = !presetVal && !userVal ? cornerPencils?.[r]?.[c] : undefined;
                const centerCandidates: number[] = [];
                const cornerCandidates: number[] = [];
                if (centerFlags) {
                  for (let d = 1; d <= Math.min(9, size); d++) if (centerFlags[d]) centerCandidates.push(d);
                }
                if (cornerFlags) {
                  for (let d = 1; d <= Math.min(9, size); d++) if (cornerFlags[d]) cornerCandidates.push(d);
                }

                return (
                  <td key={c} role="gridcell" className={cellBorderClasses(r, c)}>
                    <div
                      aria-selected={selected}
                      aria-readonly={isPreset(r, c) || undefined}
                      className={cn(
                        "relative flex size-full cursor-pointer items-center justify-center text-2xl select-none",
                        "[--sel:theme(colors.blue.300)]",
                        isCurrent(r, c) && "bg-blue-50",
                        isPreset(r, c) ? "text-foreground" : "text-blue-700 font-semibold",
                      )}
                      style={boxShadow ? { boxShadow } : undefined}
                    >
                      {selected && top_left && (
                        <span className="absolute top-0 left-0 size-[4px] rounded-br-full bg-blue-300" />
                      )}
                      {selected && top_right && (
                        <span className="absolute top-0 right-0 size-[4px] rounded-bl-full bg-blue-300" />
                      )}
                      {selected && bottom_left && (
                        <span className="absolute bottom-0 left-0 size-[4px] rounded-tr-full bg-blue-300" />
                      )}
                      {selected && bottom_right && (
                        <span className="absolute right-0 bottom-0 size-[4px] rounded-tl-full bg-blue-300" />
                      )}
                      {/* Main value */}
                      {displayVal !== "" && <span className="absolute">{displayVal}</span>}
                      {/* Corner notes: absolute around edges; omit center position if center notes present to avoid overlap */}
                      {displayVal === "" && cornerCandidates.length > 0 && (
                        <>
                          {cornerCandidates.slice(0, 9).map((digit, idx) => {
                            const baseOrder = ["tl", "tr", "bl", "br", "tc", "rc", "bc", "lc", "cc"] as const;
                            const order = centerCandidates.length > 0 ? baseOrder.slice(0, 8) : baseOrder;
                            const pos = order[idx];
                            if (!pos) return null;
                            const posCls: Record<(typeof baseOrder)[number], string> = {
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
                            return (
                              <span
                                key={`${digit}-${idx}`}
                                className={cn(posCls[pos], "text-[10px] leading-none font-semibold tracking-tight")}
                              >
                                {digit}
                              </span>
                            );
                          })}
                        </>
                      )}
                      {/* Center notes: compact string in center */}
                      {displayVal === "" && centerCandidates.length > 0 && (
                        <span className="absolute text-xs leading-none font-semibold tracking-tight">
                          {centerCandidates.join("")}
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SudokuGrid;
