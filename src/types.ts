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

export { type RectBox, type Cell, type CellSelectInfo };
