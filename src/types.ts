// /src/types.ts
import React from "react";

type RectBox = { rows: number; cols: number };
type Cell = [number, number];

type CellSelectInfo = {
  row: number;
  col: number;
  current: Cell;
  selected: boolean[][];
  event: React.MouseEvent<HTMLDivElement>;
};

// Pastel color names used for annotations
export type ColorName = "red" | "orange" | "yellow" | "green" | "blue" | "cyan" | "violet" | "pink" | "transparent";

// Imperative API exposed by the SudokuGrid component

export type SudokuGridHandle = {
  // Color annotations
  annotateColor: (color: ColorName) => void;
  annotateClear: () => void;
  // Values and notes
  setDigit: (value: number) => void; // 1..9 sets value, 0 clears
  toggleCenterNote: (digit: number) => void; // 1..9 toggles center notes
  toggleCornerNote: (digit: number) => void; // 1..9 toggles corner notes
  clearCenterNotes: () => void;
  clearCornerNotes: () => void;
  // Compact state import/export (values, notes, colors). String format is versioned and self-contained.
  exportState: () => string;
  importState: (encoded: string) => void;
};

export { type RectBox, type Cell, type CellSelectInfo };
