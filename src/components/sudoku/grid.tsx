// /src/components/sudoku/grid.tsx
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn, neighbor } from "@/lib/utils";
import { COLOR_BG_CLASS, CORNER_POS_CLASSES, CORNER_POS_ORDER_ALL, SEL_COLOR_VAR } from "@/components/sudoku/constants";
import { from36, SG1, SG1_HEADER } from "@/components/sudoku/utils/stateCodec";
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

/* =========================================================
   Types
   ========================================================= */

type SudokuGridProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number;
  presetGrid?: number[][];
  editedGrid?: number[][]; // kept for compatibility (unused)
  pencilGrid?: number[][][]; // kept for compatibility (unused)
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

/* =========================================================
   Component
   ========================================================= */

const SudokuGridImpl = React.forwardRef<SudokuGridHandle, SudokuGridProps>(function SudokuGrid(
  {
    size = 9,
    className,
    presetGrid,
    editedGrid, // kept for compatibility
    pencilGrid, // kept for compatibility
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

  /* ---------- selection / focus state ---------- */
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

  /* ---------- puzzle state ---------- */
  const [preset, setPreset] = useState<number[][]>(() => presetGrid ?? createNumberGrid(size));
  const [userGrid, setUserGrid] = useState<number[][]>(() => createNumberGrid(size));
  const [centerNotes, setCenterNotes] = useState<number[][][]>(() => createDigitCube(size));
  const [cornerNotes, setCornerNotes] = useState<number[][][]>(() => createDigitCube(size));
  const [colorGrid, setColorGrid] = useState<ColorName[][][]>(() =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => [] as ColorName[])),
  );

  /* ---------- history ---------- */
  const historyRef = useRef<string[]>([]);
  const histIndexRef = useRef<number>(-1);
  const suppressHistoryRef = useRef<number>(0);
  const MAX_HISTORY = 200;

  const snapshot = useCallback(() => {
    return SG1.buildPayload({
      size,
      preset,
      user: userGrid,
      center: centerNotes,
      corner: cornerNotes,
      colors: colorGrid,
    });
  }, [size, preset, userGrid, centerNotes, cornerNotes, colorGrid]);

  const pushHistory = useCallback((snap: string) => {
    if (suppressHistoryRef.current > 0) return;
    const h = historyRef.current;
    const idx = histIndexRef.current;
    if (idx >= 0 && h[idx] === snap) return;
    if (idx < h.length - 1) h.splice(idx + 1);
    h.push(snap);
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY);
    histIndexRef.current = h.length - 1;
  }, []);

  useEffect(() => {
    pushHistory(snapshot());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userGrid, centerNotes, cornerNotes, colorGrid]);

  /* ---------- resets on size/preset change ---------- */
  useEffect(() => {
    setPreset(presetGrid ?? createNumberGrid(size));
  }, [size, presetGrid]);

  useEffect(() => {
    setInternalSelection(emptySelection);
    setInternalCurrent(undefined);
    setSelectionStack([]);
    setUserGrid(createNumberGrid(size));
    setCenterNotes(createDigitCube(size));
    setCornerNotes(createDigitCube(size));
    setColorGrid(Array.from({ length: size }, () => Array.from({ length: size }, () => [] as ColorName[])));
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

  const isPreset = useCallback((r: number, c: number) => (preset?.[r]?.[c] ?? 0) > 0, [preset]);
  const isSelected = useCallback((r: number, c: number) => !!selection?.[r]?.[c], [selection]);

  useEffect(() => {
    if (!hasAnySelected(selection)) {
      if (!currentCell) setInternalCurrent(undefined);
      setSelectionStack([]);
      onCurrentCellChange?.(undefined);
    }
  }, [selection, currentCell, onCurrentCellChange]);

  /* =========================================================
     Small helpers
     ========================================================= */

  const applySelectionChange = useCallback(
    (next: boolean[][]) => {
      if (!selectedCells) setInternalSelection(next);
      onSelectionChange?.(next);
    },
    [selectedCells, onSelectionChange],
  );

  const applyCurrentChange = useCallback(
    (next: Cell | undefined) => {
      if (!currentCell) setInternalCurrent(next);
      onCurrentCellChange?.(next);
    },
    [currentCell, onCurrentCellChange],
  );

  const withTargets = useCallback(
    (fn: (r: number, c: number) => void) => {
      const targets = selectionTargets(selection, current);
      if (!targets.length) return false;
      for (const [r, c] of targets) fn(r, c);
      return true;
    },
    [selection, current],
  );

  const setValueOnTargets = useCallback(
    (value: number) => {
      withTargets((r, c) => {
        if (isPreset(r, c)) return;
        setUserGrid((prev) => {
          const next = prev.map((row) => row.slice());
          next[r][c] = value > 0 ? value : 0;
          return next;
        });
      });
    },
    [withTargets, isPreset],
  );

  const toggleDigitIn = useCallback(
    (setCube: React.Dispatch<React.SetStateAction<number[][][]>>, digit: number) => {
      if (digit < 1 || digit > size) return;
      withTargets((r, c) => {
        if (isPreset(r, c)) return;
        setCube((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice()));
          next[r][c][digit] = next[r][c][digit] ? 0 : 1;
          return next;
        });
      });
    },
    [withTargets, isPreset, size],
  );

  const clearDigitsIn = useCallback(
    (setCube: React.Dispatch<React.SetStateAction<number[][][]>>) => {
      withTargets((r, c) => {
        if (isPreset(r, c)) return;
        setCube((prev) => {
          const next = prev.map((row) => row.map((cell) => cell.slice()));
          next[r][c].fill(0);
          return next;
        });
      });
    },
    [withTargets, isPreset],
  );

  /* =========================================================
     Imperative API
     ========================================================= */

  useImperativeHandle(
    ref,
    (): SudokuGridHandle => ({
      annotateColor: (color: ColorName) => {
        withTargets((r, c) => {
          setColorGrid((prev) => {
            const next = prev.map((row) => row.map((cell) => cell.slice()));
            const list = next[r][c];
            const idx = list.indexOf(color);
            if (idx >= 0) list.splice(idx, 1);
            else list.push(color);
            return next;
          });
        });
      },
      annotateClear: () => {
        withTargets((r, c) => {
          setColorGrid((prev) => {
            const next = prev.map((row) => row.map((cell) => cell.slice())) as ColorName[][][];
            next[r][c] = [];
            return next;
          });
        });
      },
      setDigit: (value: number) => setValueOnTargets(value),
      toggleCenterNote: (d: number) => toggleDigitIn(setCenterNotes, d),
      toggleCornerNote: (d: number) => toggleDigitIn(setCornerNotes, d),
      clearCenterNotes: () => clearDigitsIn(setCenterNotes),
      clearCornerNotes: () => clearDigitsIn(setCornerNotes),
      exportState: () =>
        SG1.buildPayload({
          size,
          preset,
          user: userGrid,
          center: centerNotes,
          corner: cornerNotes,
          colors: colorGrid,
        }),
      importState: (encoded: string) => {
        if (!encoded || !encoded.startsWith(SG1_HEADER)) throw new Error("Invalid state payload");
        const parts = encoded.split("|");
        if (parts.length < 7) throw new Error("Corrupt state: missing segments");

        const parsedSize = from36(parts[1]);
        if (parsedSize !== size) throw new Error(`State size ${parsedSize} does not match grid size ${size}`);

        suppressHistoryRef.current++;
        try {
          const nextPreset = SG1.decodeNumGrid(parts[2], size);
          const nextUser = SG1.decodeNumGrid(parts[3], size);
          const nextCenter = SG1.decodeDigitCube(parts[4], size);
          const nextCorner = SG1.decodeDigitCube(parts[5], size);
          const nextColors = SG1.decodeColors(parts[6], size);

          // preset wins over user/notes
          for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
              if ((nextPreset?.[r]?.[c] ?? 0) > 0) {
                nextUser[r][c] = 0;
                nextCenter[r][c].fill(0);
                nextCorner[r][c].fill(0);
              }
            }
          }

          setPreset(nextPreset);
          setUserGrid(nextUser);
          setCenterNotes(nextCenter);
          setCornerNotes(nextCorner);
          setColorGrid(nextColors);
        } finally {
          setTimeout(() => suppressHistoryRef.current--, 0);
        }
      },
      reset: () => {
        setUserGrid(createNumberGrid(size));
        setCenterNotes(createDigitCube(size));
        setCornerNotes(createDigitCube(size));
        setColorGrid(Array.from({ length: size }, () => Array.from({ length: size }, () => [] as ColorName[])));
      },
      undo: () => {
        const h = historyRef.current;
        if (!h.length) return false;
        const idx = histIndexRef.current;
        if (idx <= 0) return false;
        const snap = h[idx - 1];
        suppressHistoryRef.current++;
        try {
          const parts = snap.split("|");
          setUserGrid(SG1.decodeNumGrid(parts[3], size));
          setCenterNotes(SG1.decodeDigitCube(parts[4], size));
          setCornerNotes(SG1.decodeDigitCube(parts[5], size));
          setColorGrid(SG1.decodeColors(parts[6], size));
          histIndexRef.current = idx - 1;
        } finally {
          setTimeout(() => suppressHistoryRef.current--, 0);
        }
        return true;
      },
      redo: () => {
        const h = historyRef.current;
        if (!h.length) return false;
        const idx = histIndexRef.current;
        if (idx >= h.length - 1) return false;
        const snap = h[idx + 1];
        suppressHistoryRef.current++;
        try {
          const parts = snap.split("|");
          setUserGrid(SG1.decodeNumGrid(parts[3], size));
          setCenterNotes(SG1.decodeDigitCube(parts[4], size));
          setCornerNotes(SG1.decodeDigitCube(parts[5], size));
          setColorGrid(SG1.decodeColors(parts[6], size));
          histIndexRef.current = idx + 1;
        } finally {
          setTimeout(() => suppressHistoryRef.current--, 0);
        }
        return true;
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      selection,
      current,
      isPreset,
      size,
      preset,
      userGrid,
      centerNotes,
      cornerNotes,
      colorGrid,
      withTargets,
      setValueOnTargets,
      toggleDigitIn,
      clearDigitsIn,
    ],
  );

  /* =========================================================
     Pointer -> cell mapping + selection gestures
     ========================================================= */

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

  const onPointerDownGrid = useCallback(
    (e: React.PointerEvent<HTMLTableSectionElement>) => {
      const cell = getCellFromPointer(e);
      if (!cell) return;
      wrapperRef.current?.focus();
      const [r, c] = cell;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      const base = ctrl ? selection.map((row) => row.slice()) : createEmptySelection(size);
      let working = base.map((row) => row.slice());

      const mode: "rect" | "paint-add" | "paint-erase" = ctrl
        ? base[r][c]
          ? "paint-erase"
          : "paint-add"
        : shift
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
        setSelectionStack(ctrl ? (prev) => pushIfAbsent([...prev], [r, c]) : [[r, c]]);
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

  /* =========================================================
     Keyboard
     ========================================================= */

  const moveCurrent = useCallback(
    (dr: number, dc: number) => {
      let base: Cell | undefined = current;
      if (!base) {
        base = hasAnySelected(selection) ? stackFromMatrix(selection)[0] : [0, 0];
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
        if (pencilMode === "center") clearDigitsIn(setCenterNotes);
        else if (pencilMode === "corner") clearDigitsIn(setCornerNotes);
        else setValueOnTargets(0);
        return;
      }

      // 1..9 only (stable UI for size > 9)
      if (/^[1-9]$/.test(key)) {
        const val = parseInt(key, 10);
        if (val >= 1 && val <= Math.min(9, size)) {
          e.preventDefault();
          if (pencilMode === "center") toggleDigitIn(setCenterNotes, val);
          else if (pencilMode === "corner") toggleDigitIn(setCornerNotes, val);
          else setValueOnTargets(val);
        }
      }
    },
    [
      applySelectionChange,
      size,
      applyCurrentChange,
      moveCurrent,
      pencilMode,
      clearDigitsIn,
      setValueOnTargets,
      toggleDigitIn,
    ],
  );

  // Keep focus when mode toggles while something is selected
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if ((hasAnySelected(selection) || !!current) && document.activeElement !== el) el.focus();
  }, [pencilMode, selection, current]);

  /* =========================================================
     Render
     ========================================================= */

  const cellBorderClasses = useCallback(
    (r: number, c: number) => {
      const base = [
        "size-10",
        "border",
        "border-foreground",
        "dark:border-muted",
        "text-center",
        "select-none",
        "cursor-pointer",
        cellClassName,
      ]
        .filter(Boolean)
        .join(" ");

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

      return cn(base, thick.join(" "));
    },
    [regions, getRegionId, size, activeBox, dividerClassName, cellClassName],
  );

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
                // neighbor selection checks (avoid repeated neighbor() calls)
                const nUp = r > 0 ? neighbor({ row: r, col: c }, -1, 0, size) : null;
                const nRight = c < size - 1 ? neighbor({ row: r, col: c }, 0, 1, size) : null;
                const nDown = r < size - 1 ? neighbor({ row: r, col: c }, 1, 0, size) : null;
                const nLeft = c > 0 ? neighbor({ row: r, col: c }, 0, -1, size) : null;

                const up = nUp ? isSelected(nUp.row, nUp.col) : false;
                const right = nRight ? isSelected(nRight.row, nRight.col) : false;
                const down = nDown ? isSelected(nDown.row, nDown.col) : false;
                const left = nLeft ? isSelected(nLeft.row, nLeft.col) : false;

                const topLeft = c > 0 && r > 0 && !isSelected(r - 1, c - 1) && up && left;
                const topRight = c < size - 1 && r > 0 && !isSelected(r - 1, c + 1) && up && right;
                const bottomLeft = c > 0 && r < size - 1 && !isSelected(r + 1, c - 1) && down && left;
                const bottomRight = c < size - 1 && r < size - 1 && !isSelected(r + 1, c + 1) && down && right;

                const selected = isSelected(r, c);

                const presetVal = preset?.[r]?.[c] ?? 0;
                const userVal = userGrid?.[r]?.[c] ?? 0;
                const displayVal = presetVal > 0 ? presetVal : userVal > 0 ? userVal : "";

                const centerFlags = !presetVal && !userVal ? centerNotes?.[r]?.[c] : undefined;
                const cornerFlags = !presetVal && !userVal ? cornerNotes?.[r]?.[c] : undefined;

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
                      {cellColors.length > 0 && (
                        <div className="pointer-events-none absolute inset-0 flex overflow-hidden">
                          {cellColors.map((clr, i) => (
                            <div key={i} className={cn("h-full flex-1", COLOR_BG_CLASS[clr])} />
                          ))}
                        </div>
                      )}

                      {selected && (
                        <div className="pointer-events-none absolute inset-0 z-10 bg-white/20 dark:bg-black/10" />
                      )}

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
