import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn, neighbor } from "@/lib/utils";
import { COLOR_BG_CLASS, CORNER_POS_CLASSES, CORNER_POS_ORDER_ALL, SEL_COLOR_VAR } from "@/components/sudoku/constants";
import {
  buildSingleSelection,
  computeDefaultBox,
  createEmptySelection,
  hasAnySelected,
  indexInStack,
  normalizeSelection,
  pushIfAbsent,
  removeFromStack,
  sameCell,
  stackFromMatrix,
  validateRegions,
} from "@/components/sudoku/utils/selection";
import { Cell, CellSelectInfo, ColorName, RectBox, SudokuGridHandle } from "@/types";
import { createDigitCube, createNumberGrid, selectionTargets } from "@/components/sudoku/utils/grids";

type SudokuGridProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number;
  presetGrid?: number[][];
  editedGrid?: number[][];
  pencilGrid?: number[][][];
  pencilMode?: "center" | "corner" | "color" | null;
  currentCell?: Cell;
  selectedCells?: boolean[][];
  onCellSelect?: (info: CellSelectInfo) => void;
  onSelectionChange?: (selected: boolean[][]) => void;
  onCurrentCellChange?: (cell: Cell | undefined) => void;
  box?: RectBox;
  regions?: number[][];
  cellClassName?: string;
  dividerClassName?: string;
};

// --- Compact export/import helpers (version: SG1) ---
const HEADER = "SG1|" as const;
const colorToCode: Record<ColorName, string> = {
  red: "r",
  orange: "o",
  yellow: "y",
  green: "g",
  blue: "b",
  cyan: "c",
  violet: "v",
  pink: "p",
  transparent: "t",
};
const codeToColor: Record<string, ColorName> = Object.fromEntries(
  Object.entries(colorToCode).map(([k, v]) => [v, k as ColorName]),
) as Record<string, ColorName>;

function toBase36(n: number): string {
  return n.toString(36);
}
function fromBase36(s: string): number {
  return parseInt(s, 36);
}
function encodeNumberGrid(grid: number[][], size: number): string {
  const n = size * size;
  const out: string[] = new Array(n);
  let i = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid?.[r]?.[c] ?? 0;
      if (v < 0 || v >= 36) throw new Error("Value out of encodable range (0..35)");
      out[i++] = toBase36(v);
    }
  }
  return out.join("");
}
function decodeNumberGrid(s: string, size: number): number[][] {
  const n = size * size;
  if (s.length !== n) throw new Error("Corrupt state: number grid length mismatch");
  const grid = createNumberGrid(size);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / size);
    const c = i % size;
    grid[r][c] = fromBase36(s[i]) || 0;
  }
  return grid;
}
function maskWidthForSize(size: number): number {
  // width in base36 needed to store (1<<size)-1; safe for size <= 31
  const maxMask = Math.max(0, Math.pow(2, size) - 1);
  return Math.max(1, maxMask.toString(36).length);
}
function encodeCubeMask(cube: number[][][], size: number): { width: number; data: string } {
  const n = size * size;
  const width = maskWidthForSize(size);
  const parts: string[] = new Array(n);
  let idx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let mask = 0;
      const cell = cube?.[r]?.[c];
      if (cell) {
        for (let d = 1; d <= size; d++) if (cell[d]) mask |= 1 << (d - 1);
      }
      parts[idx++] = mask.toString(36).padStart(width, "0");
    }
  }
  return { width, data: parts.join("") };
}
function decodeCubeMask(payload: string, size: number): number[][][] {
  if (!payload || payload.length < 1) throw new Error("Corrupt state: empty mask payload");
  const width = fromBase36(payload[0]);
  if (width < 1 || width > 10) throw new Error("Corrupt state: invalid mask width");
  const body = payload.slice(1);
  const expected = size * size * width;
  if (body.length !== expected) throw new Error("Corrupt state: mask body length mismatch");
  const cube = createDigitCube(size);
  let i = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const chunk = body.slice(i, i + width);
      i += width;
      const mask = parseInt(chunk, 36) || 0;
      for (let d = 1; d <= size; d++) cube[r][c][d] = (mask >> (d - 1)) & 1 ? 1 : 0;
    }
  }
  return cube;
}
function encodeColors(grid: ColorName[][][], size: number): string {
  let out = "";
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const list = grid?.[r]?.[c] ?? [];
      const mapped = list.map((clr) => colorToCode[clr] ?? "").join("");
      if (mapped.length >= 36) throw new Error("Too many color stripes in a cell (max 35)");
      out += toBase36(mapped.length) + mapped;
    }
  }
  return out;
}
function decodeColors(s: string, size: number): ColorName[][][] {
  const grid: ColorName[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => [] as ColorName[]),
  );
  let i = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (i >= s.length) throw new Error("Corrupt state: truncated colors segment");
      const len = fromBase36(s[i]);
      i += 1;
      const seg = s.slice(i, i + len);
      i += len;
      const list: ColorName[] = [];
      for (let k = 0; k < seg.length; k++) {
        const clr = codeToColor[seg[k]];
        if (clr) list.push(clr);
      }
      grid[r][c] = list;
    }
  }
  // Ignore any trailing characters up to next '|', parser will split segments appropriately
  return grid;
}

/* ---------- Component ---------- */
const SudokuGridImpl = React.forwardRef<SudokuGridHandle, SudokuGridProps>(function SudokuGrid(
  {
    size = 9,
    className,
    presetGrid,
    editedGrid, // kept for API compatibility
    pencilGrid, // kept for API compatibility
    pencilMode = null,
    currentCell,
    selectedCells,
    onCellSelect,
    onSelectionChange,
    onCurrentCellChange,
    box,
    regions,
    cellClassName,
    dividerClassName = "border-foreground dark:border-muted",
    ...props
  },
  ref,
) {
  if (!Number.isInteger(size) || size <= 0) throw new Error("Size must be a positive integer.");
  validateRegions(regions, size);

  const emptySelection = useMemo(() => createEmptySelection(size), [size]);

  const [internalCurrent, setInternalCurrent] = useState<Cell | undefined>(undefined);
  const [internalSelection, setInternalSelection] = useState<boolean[][]>(emptySelection);
  const [selectionStack, setSelectionStack] = useState<Cell[]>([]);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLTableSectionElement | null>(null);
  const draggingRef = useRef<boolean>(false);
  const dragRef = useRef<{
    mode: "rect" | "paint-add" | "paint-erase";
    start: Cell;
    base: boolean[][];
    working: boolean[][];
    visited: Set<number>;
    last?: Cell;
  } | null>(null);

  // user-entered values and notes (sized to "size", not hardcoded 9)
  const [userGrid, setUserGrid] = useState<number[][]>(() => createNumberGrid(size));
  const [pencils, setPencils] = useState<number[][][]>(() => createDigitCube(size));
  const [cornerPencils, setCornerPencils] = useState<number[][][]>(() => createDigitCube(size));
  // color annotations grid: array of color stripes per cell
  const [colorGrid, setColorGrid] = useState<ColorName[][][]>(() =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => [] as ColorName[])),
  );

  // --- History management ---
  const historyRef = useRef<string[]>([]);
  const histIndexRef = useRef<number>(-1);
  const suppressHistoryRef = useRef<number>(0);
  const MAX_HISTORY = 200;

  const makeSnapshot = useCallback(() => {
    const sizeStr = toBase36(size);
    const preset = encodeNumberGrid(presetGrid ?? createNumberGrid(size), size);
    const user = encodeNumberGrid(userGrid, size);
    const cCenter = encodeCubeMask(pencils, size);
    const cCorner = encodeCubeMask(cornerPencils, size);
    const colors = encodeColors(colorGrid, size);
    const centerSeg = toBase36(cCenter.width) + cCenter.data;
    const cornerSeg = toBase36(cCorner.width) + cCorner.data;
    return [HEADER.slice(0, -1), sizeStr, preset, user, centerSeg, cornerSeg, colors, ""].join("|");
  }, [size, presetGrid, userGrid, pencils, cornerPencils, colorGrid]);

  const pushHistory = useCallback((snap: string) => {
    if (suppressHistoryRef.current > 0) return;
    const h = historyRef.current;
    const idx = histIndexRef.current;
    if (idx >= 0 && h[idx] === snap) return;
    // drop redo tail
    if (idx < h.length - 1) h.splice(idx + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
    histIndexRef.current = h.length - 1;
  }, []);

  // Push a snapshot whenever the user-modifiable grids change
  useEffect(() => {
    const snap = makeSnapshot();
    pushHistory(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGrid, pencils, cornerPencils, colorGrid]);

  useEffect(() => {
    setInternalSelection(emptySelection);
    setInternalCurrent(undefined);
    setSelectionStack([]);
    setUserGrid(createNumberGrid(size));
    setPencils(createDigitCube(size));
    setCornerPencils(createDigitCube(size));
    setColorGrid(Array.from({ length: size }, () => Array.from({ length: size }, () => [] as ColorName[])));
    // Reset history when size changes
    historyRef.current = [];
    histIndexRef.current = -1;
  }, [size, emptySelection]);

  const activeBox = useMemo(() => box ?? computeDefaultBox(size), [box, size]);

  const getRegionId = useMemo(() => {
    if (regions) return (r: number, c: number) => regions[r][c];
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

  const isPreset = useCallback((r: number, c: number) => (presetGrid?.[r]?.[c] ?? 0) > 0, [presetGrid]);

  useEffect(() => {
    if (!hasAnySelected(selection)) {
      if (!currentCell) setInternalCurrent(undefined);
      setSelectionStack([]);
      onCurrentCellChange?.(undefined);
    }
  }, [selection, currentCell, onCurrentCellChange]);

  const isSelected = useCallback((r: number, c: number) => !!selection?.[r]?.[c], [selection]);

  const cellBorderClasses = useCallback(
    (r: number, c: number) => {
      const base: string[] = [
        "size-10",
        "border",
        "border-foreground",
        "dark:border-muted",
        "text-center",
        "select-none",
        "cursor-pointer",
      ];
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
    (nextCurrent: Cell | undefined) => {
      if (!currentCell) setInternalCurrent(nextCurrent);
      onCurrentCellChange?.(nextCurrent);
    },
    [currentCell, onCurrentCellChange],
  );

  // Expose imperative color annotation API and new digit/note methods
  useImperativeHandle(
    ref,
    (): SudokuGridHandle => ({
      annotateColor: (color: ColorName) => {
        const targets = selectionTargets(selection, current);
        if (!targets.length) return;
        setColorGrid((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice()));
          for (const [r, c] of targets) {
            const list = next[r][c];
            const idx = list.indexOf(color);
            if (idx >= 0) list.splice(idx, 1);
            else list.push(color);
          }
          return next;
        });
      },
      annotateClear: () => {
        const targets = selectionTargets(selection, current);
        if (!targets.length) return;
        setColorGrid((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice())) as ColorName[][][];
          for (const [r, c] of targets) {
            next[r][c] = [];
          }
          return next;
        });
      },
      setDigit: (value: number) => {
        const targets = selectionTargets(selection, current);
        if (!targets.length) return;
        setUserGrid((prev) => {
          const next = prev.map((row) => row.slice());
          for (const [r, c] of targets) {
            if (isPreset(r, c)) continue;
            next[r][c] = value > 0 ? value : 0;
          }
          return next;
        });
      },
      toggleCenterNote: (digit: number) => {
        if (digit < 1 || digit > size) return;
        const targets = selectionTargets(selection, current);
        if (!targets.length) return;
        setPencils((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice()));
          for (const [r, c] of targets) {
            if (isPreset(r, c)) continue;
            next[r][c][digit] = next[r][c][digit] ? 0 : 1;
          }
          return next;
        });
      },
      toggleCornerNote: (digit: number) => {
        if (digit < 1 || digit > size) return;
        const targets = selectionTargets(selection, current);
        if (!targets.length) return;
        setCornerPencils((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice()));
          for (const [r, c] of targets) {
            if (isPreset(r, c)) continue;
            next[r][c][digit] = next[r][c][digit] ? 0 : 1;
          }
          return next;
        });
      },
      clearCenterNotes: () => {
        const targets = selectionTargets(selection, current);
        if (!targets.length) return;
        setPencils((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice()));
          for (const [r, c] of targets) {
            if (isPreset(r, c)) continue;
            next[r][c].fill(0);
          }
          return next;
        });
      },
      clearCornerNotes: () => {
        const targets = selectionTargets(selection, current);
        if (!targets.length) return;
        setCornerPencils((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice()));
          for (const [r, c] of targets) {
            if (isPreset(r, c)) continue;
            next[r][c].fill(0);
          }
          return next;
        });
      },
      exportState: () => {
        // Header + size
        const sizeStr = toBase36(size);
        const preset = encodeNumberGrid(presetGrid ?? createNumberGrid(size), size);
        const user = encodeNumberGrid(userGrid, size);
        const cCenter = encodeCubeMask(pencils, size);
        const cCorner = encodeCubeMask(cornerPencils, size);
        const colors = encodeColors(colorGrid, size);
        // center and corner include their widths as a leading base36 char
        const centerSeg = toBase36(cCenter.width) + cCenter.data;
        const cornerSeg = toBase36(cCorner.width) + cCorner.data;
        return [HEADER.slice(0, -1), sizeStr, preset, user, centerSeg, cornerSeg, colors, ""].join("|");
      },
      importState: (encoded: string) => {
        if (!encoded || !encoded.startsWith(HEADER)) throw new Error("Invalid state payload");
        // SG1|<size>|<preset>|<user>|<center>|<corner>|<colors>|
        const parts = encoded.split("|");
        // parts: [ 'SG1', size, preset, user, center, corner, colors, ... ]
        if (parts.length < 7) throw new Error("Corrupt state: missing segments");
        const sizeStr = parts[1];
        const parsedSize = fromBase36(sizeStr);
        if (parsedSize !== size) throw new Error(`State size ${parsedSize} does not match grid size ${size}`);
        const userStr = parts[3];
        const centerStr = parts[4];
        const cornerStr = parts[5];
        const colorsStr = parts[6];

        // Suppress history when importing state
        suppressHistoryRef.current++;
        setUserGrid(decodeNumberGrid(userStr, size));
        setPencils(decodeCubeMask(centerStr, size));
        setCornerPencils(decodeCubeMask(cornerStr, size));
        setColorGrid(decodeColors(colorsStr, size));
        setTimeout(() => {
          suppressHistoryRef.current--;
        }, 0);
      },
      // History and reset implementation
      reset: () => {
        setUserGrid(createNumberGrid(size));
        setPencils(createDigitCube(size));
        setCornerPencils(createDigitCube(size));
        setColorGrid(Array.from({ length: size }, () => Array.from({ length: size }, () => [] as ColorName[])));
      },
      undo: () => {
        const h = historyRef.current;
        if (h.length === 0) return false;
        const idx = histIndexRef.current;
        if (idx <= 0) return false;
        const snap = h[idx - 1];
        suppressHistoryRef.current++;
        try {
          // Reuse importState logic but only for user state
          const parts = snap.split("|");
          const userStr = parts[3];
          const centerStr = parts[4];
          const cornerStr = parts[5];
          const colorsStr = parts[6];
          setUserGrid(decodeNumberGrid(userStr, size));
          setPencils(decodeCubeMask(centerStr, size));
          setCornerPencils(decodeCubeMask(cornerStr, size));
          setColorGrid(decodeColors(colorsStr, size));
          histIndexRef.current = idx - 1;
        } finally {
          setTimeout(() => {
            suppressHistoryRef.current--;
          }, 0);
        }
        return true;
      },
      redo: () => {
        const h = historyRef.current;
        if (h.length === 0) return false;
        const idx = histIndexRef.current;
        if (idx >= h.length - 1) return false;
        const snap = h[idx + 1];
        suppressHistoryRef.current++;
        try {
          const parts = snap.split("|");
          const userStr = parts[3];
          const centerStr = parts[4];
          const cornerStr = parts[5];
          const colorsStr = parts[6];
          setUserGrid(decodeNumberGrid(userStr, size));
          setPencils(decodeCubeMask(centerStr, size));
          setCornerPencils(decodeCubeMask(cornerStr, size));
          setColorGrid(decodeColors(colorsStr, size));
          histIndexRef.current = idx + 1;
        } finally {
          setTimeout(() => {
            suppressHistoryRef.current--;
          }, 0);
        }
        return true;
      },
    }),
    [selection, current, isPreset, size, presetGrid, userGrid, pencils, cornerPencils, colorGrid],
  );

  // pointer -> cell mapping
  const clampIndex = useCallback((v: number, max: number) => Math.max(0, Math.min(max - 1, v)), []);
  const getCellFromPointer = useCallback(
    (e: React.PointerEvent | PointerEvent): Cell | undefined => {
      const el = gridRef.current;
      if (!el) return undefined;
      const rect = el.getBoundingClientRect();
      const x = (e as React.PointerEvent).clientX - rect.left;
      const y = (e as React.PointerEvent).clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return undefined;
      const c = clampIndex(Math.floor((x / rect.width) * size), size);
      const r = clampIndex(Math.floor((y / rect.height) * size), size);
      return [r, c];
    },
    [size, clampIndex],
  );

  // pointer selection
  const onPointerDownGrid = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      const cell = getCellFromPointer(e);
      if (!cell) return;
      wrapperRef.current?.focus();
      const [r, c] = cell;

      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      const base = isCtrl ? selection.map((row) => row.slice()) : createEmptySelection(size);
      let working = base.map((row) => row.slice());

      const mode: "rect" | "paint-add" | "paint-erase" = isCtrl
        ? base[r][c]
          ? "paint-erase"
          : "paint-add"
        : isShift
          ? "rect"
          : "paint-add";

      const info = {
        mode,
        start: [r, c] as Cell,
        base,
        working,
        visited: new Set<number>([r * size + c]),
        last: [r, c] as Cell,
      };

      if (mode === "rect") {
        working = createEmptySelection(size);
        working[r][c] = true;
        info.working = working;
        setSelectionStack([[r, c]]);
        applySelectionChange(working);
        applyCurrentChange([r, c]);
      } else if (mode === "paint-add") {
        working[r][c] = true;
        info.working = working;
        setSelectionStack(isCtrl ? (prev) => pushIfAbsent([...prev], [r, c]) : [[r, c]]);
        applySelectionChange(working.map((row) => row.slice()));
        applyCurrentChange([r, c]);
      } else {
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
        const r0 = Math.min(sr, r),
          r1 = Math.max(sr, r);
        const c0 = Math.min(sc, c),
          c1 = Math.max(sc, c);
        const working = createEmptySelection(size);
        for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) working[rr][cc] = true;
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
        const key = r * size + c;
        if (!info.visited.has(key)) {
          info.visited.add(key);
          if (info.working[r][c]) {
            info.working[r][c] = false;
            info.last = [r, c];
            setSelectionStack((prev) => removeFromStack(prev, [r, c]));
            applySelectionChange(info.working.map((row) => row.slice()));
            if (current && sameCell(current, [r, c])) {
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

  const finishDrag = useCallback(() => {
    if (!dragRef.current) return;
    const info = dragRef.current;
    if (info.mode === "rect" || info.mode === "paint-add") applyCurrentChange(info.last ?? info.start);
    dragRef.current = null;
    draggingRef.current = false;
  }, [applyCurrentChange]);

  const onPointerUpGrid = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      finishDrag();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    },
    [finishDrag],
  );

  const onPointerLeaveGrid = useCallback(() => {
    if (!draggingRef.current) return;
    finishDrag();
  }, [finishDrag]);

  // value / pencil operations
  const applyValueToSelection = useCallback(
    (value: number) => {
      const targets = selectionTargets(selection, current);
      if (targets.length === 0) return;
      setUserGrid((prev) => {
        const next = prev.map((row) => row.slice());
        for (const [r, c] of targets) {
          if (isPreset(r, c)) continue;
          next[r][c] = value > 0 ? value : 0;
        }
        return next;
      });
    },
    [selection, current, isPreset],
  );

  const toggleDigitInCube = useCallback(
    (setCube: React.Dispatch<React.SetStateAction<number[][][]>>, digit: number) => {
      if (digit < 1 || digit > size) return;
      const targets = selectionTargets(selection, current);
      if (!targets.length) return;
      setCube((prev) => {
        const next = prev.map((row) => row.map((cell) => cell.slice()));
        for (const [r, c] of targets) {
          if (isPreset(r, c)) continue;
          next[r][c][digit] = next[r][c][digit] ? 0 : 1;
        }
        return next;
      });
    },
    [selection, current, isPreset, size],
  );

  const clearCubeDigits = useCallback(
    (setCube: React.Dispatch<React.SetStateAction<number[][][]>>) => {
      const targets = selectionTargets(selection, current);
      if (!targets.length) return;
      setCube((prev) => {
        const next = prev.map((row) => row.map((cell) => cell.slice()));
        for (const [r, c] of targets) {
          if (isPreset(r, c)) continue;
          next[r][c].fill(0);
        }
        return next;
      });
    },
    [selection, current, isPreset],
  );

  // keyboard
  const moveCurrent = useCallback(
    (dr: number, dc: number) => {
      let base: Cell | undefined = current;
      if (!base) {
        if (hasAnySelected(selection)) base = stackFromMatrix(selection)[0];
        else base = [0, 0];
      }
      const n = neighbor({ row: base![0], col: base![1] }, dr, dc, size);
      const next: Cell = [n.row, n.col];
      applyCurrentChange(next);
      applySelectionChange(buildSingleSelection(size, next[0], next[1]));
      setSelectionStack([next]);
    },
    [current, selection, size, applyCurrentChange, applySelectionChange],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const key = e.key;

      if (key === "Escape") {
        e.preventDefault();
        applySelectionChange(createEmptySelection(size));
        applyCurrentChange(undefined);
        setSelectionStack([]);
        return;
      }

      if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
        e.preventDefault();
        if (key === "ArrowUp") moveCurrent(-1, 0);
        if (key === "ArrowDown") moveCurrent(1, 0);
        if (key === "ArrowLeft") moveCurrent(0, -1);
        if (key === "ArrowRight") moveCurrent(0, 1);
        return;
      }

      if (key === "Backspace" || key === "Delete" || key === "0") {
        e.preventDefault();
        if (pencilMode === "center") clearCubeDigits(setPencils);
        else if (pencilMode === "corner") clearCubeDigits(setCornerPencils);
        else applyValueToSelection(0);
        return;
      }

      // digits 1..9 only (kept to avoid layout issues for sizes > 9)
      if (/^[1-9]$/.test(key)) {
        const val = parseInt(key, 10);
        if (val >= 1 && val <= Math.min(9, size)) {
          e.preventDefault();
          if (pencilMode === "center") toggleDigitInCube(setPencils, val);
          else if (pencilMode === "corner") toggleDigitInCube(setCornerPencils, val);
          else applyValueToSelection(val);
        }
      }
    },
    [
      applySelectionChange,
      size,
      applyCurrentChange,
      moveCurrent,
      pencilMode,
      clearCubeDigits,
      applyValueToSelection,
      toggleDigitInCube,
    ],
  );

  // Ensure the grid retains keyboard focus after toggling pencil/notes mode
  useEffect(() => {
    if (!wrapperRef.current) return;
    // Only refocus if there's something selected or a current cell, to avoid stealing focus unnecessarily
    if ((hasAnySelected(selection) || !!current) && document.activeElement !== wrapperRef.current) {
      wrapperRef.current.focus();
    }
  }, [pencilMode, selection, current]);

  return (
    <div ref={wrapperRef} tabIndex={0} onKeyDown={onKeyDown} className="outline-none focus:outline-none">
      <table role="grid" aria-rowcount={size} aria-colcount={size}>
        <tbody
          ref={gridRef}
          className={className}
          onPointerDown={onPointerDownGrid}
          onPointerMove={onPointerMoveGrid}
          onPointerUp={onPointerUpGrid}
          onPointerLeave={onPointerLeaveGrid}
          {...props}
        >
          {Array.from({ length: size }).map((_, r) => (
            <tr key={r} role="row">
              {Array.from({ length: size }).map((_, c) => {
                const up =
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
                const down =
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

                const topLeft = c > 0 && r > 0 && !isSelected(r - 1, c - 1) && up && left;
                const topRight = c < size - 1 && r > 0 && !isSelected(r - 1, c + 1) && up && right;
                const bottomLeft = c > 0 && r < size - 1 && !isSelected(r + 1, c - 1) && down && left;
                const bottomRight = c < size - 1 && r < size - 1 && !isSelected(r + 1, c + 1) && down && right;

                const selected = isSelected(r, c);
                // selection highlight is drawn with absolute edge spans (above color stripes)

                const presetVal = presetGrid?.[r]?.[c] ?? 0;
                const userVal = userGrid?.[r]?.[c] ?? 0;
                const displayVal = presetVal > 0 ? presetVal : userVal > 0 ? userVal : "";

                const centerFlags = !presetVal && !userVal ? pencils?.[r]?.[c] : undefined;
                const cornerFlags = !presetVal && !userVal ? cornerPencils?.[r]?.[c] : undefined;

                const maxDigitShown = Math.min(9, size);
                const centerCandidates: number[] = [];
                const cornerCandidates: number[] = [];
                if (centerFlags) for (let d = 1; d <= maxDigitShown; d++) if (centerFlags[d]) centerCandidates.push(d);
                if (cornerFlags) for (let d = 1; d <= maxDigitShown; d++) if (cornerFlags[d]) cornerCandidates.push(d);

                const order = centerCandidates.length > 0 ? CORNER_POS_ORDER_ALL.slice(0, 8) : CORNER_POS_ORDER_ALL;

                const cellColors = colorGrid?.[r]?.[c] ?? [];

                return (
                  <td key={c} role="gridcell" className={cellBorderClasses(r, c)}>
                    <div
                      aria-selected={selected}
                      aria-readonly={isPreset(r, c) || undefined}
                      className={cn(
                        "relative flex size-full cursor-pointer items-center justify-center text-2xl select-none",
                        SEL_COLOR_VAR,
                        isPreset(r, c) ? "text-foreground" : "text-blue-700 dark:text-blue-400 font-bold font-serif",
                      )}
                    >
                      {/* Color stripes background */}
                      {cellColors.length > 0 && (
                        // eslint-disable-next-line better-tailwindcss/enforce-consistent-class-order
                        <div className="absolute inset-0 overflow-hidden flex pointer-events-none">
                          {cellColors.map((clr, i) => (
                            <div key={i} className={cn("h-full flex-1", COLOR_BG_CLASS[clr])} />
                          ))}
                        </div>
                      )}

                      {/* Subtle selection highlight (below borders, above content) */}
                      {selected && (
                        <div className="pointer-events-none absolute inset-0 z-10 bg-white/20 dark:bg-black/10" />
                      )}

                      {/* Selection edges (above highlight) */}
                      {selected && !left && (
                        <span
                          className="pointer-events-none absolute top-0 bottom-0 left-0 z-20 w-[4px]"
                          style={{ background: "var(--sel)" }}
                        />
                      )}
                      {selected && !right && (
                        <span
                          className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 w-[4px]"
                          style={{ background: "var(--sel)" }}
                        />
                      )}
                      {selected && !up && (
                        <span
                          className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-[4px]"
                          style={{ background: "var(--sel)" }}
                        />
                      )}
                      {selected && !down && (
                        <span
                          className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-[4px]"
                          style={{ background: "var(--sel)" }}
                        />
                      )}

                      {selected && topLeft && (
                        <span className="absolute top-0 left-0 z-20 size-[4px] rounded-br-xs bg-(--sel)" />
                      )}
                      {selected && topRight && (
                        <span className="absolute top-0 right-0 z-20 size-[4px] rounded-bl-xs bg-(--sel)" />
                      )}
                      {selected && bottomLeft && (
                        <span className="absolute bottom-0 left-0 z-20 size-[4px] rounded-tr-xs bg-(--sel)" />
                      )}
                      {selected && bottomRight && (
                        <span className="absolute right-0 bottom-0 z-20 size-[4px] rounded-tl-xs bg-(--sel)" />
                      )}

                      {displayVal !== "" && <span className="absolute">{displayVal}</span>}

                      {displayVal === "" && cornerCandidates.length > 0 && (
                        <>
                          {cornerCandidates.slice(0, 9).map((digit, idx) => {
                            const pos = order[idx];
                            if (!pos) return null;
                            return (
                              <span
                                key={`${digit}-${idx}`}
                                className={cn(
                                  CORNER_POS_CLASSES[pos],
                                  "text-xxs leading-none font-semibold tracking-tight",
                                )}
                              >
                                {digit}
                              </span>
                            );
                          })}
                        </>
                      )}

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
});

export const SudokuGrid = React.memo(SudokuGridImpl);
