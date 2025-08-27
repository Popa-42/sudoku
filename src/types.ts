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
export type ColorName =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "cyan"
  | "violet"
  | "pink"
  | "black"
  | "transparent";

// Imperative API exposed by the SudokuGrid component

export type SudokuGridHandle = {
  annotateColor: (color: ColorName) => void;
  annotateClear: () => void;
};

export { type RectBox, type Cell, type CellSelectInfo };
