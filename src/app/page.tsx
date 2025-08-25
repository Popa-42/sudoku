"use client";

import SudokuGrid from "@/components/sudoku/grid";
import React from "react";

export default function Home() {
  // const regions9: number[][] = [
  //   [0, 0, 0, 1, 1, 1, 2, 2, 2],
  //   [0, 0, 0, 1, 1, 1, 2, 2, 2],
  //   [0, 0, 0, 1, 1, 1, 2, 2, 2],
  //   [3, 3, 3, 4, 4, 4, 5, 5, 5],
  //   [3, 3, 4, 4, 4, 5, 5, 5, 5],
  //   [3, 3, 3, 3, 4, 4, 4, 5, 5],
  //   [6, 6, 6, 7, 7, 7, 8, 8, 8],
  //   [6, 6, 6, 7, 7, 7, 8, 8, 8],
  //   [6, 6, 6, 7, 7, 7, 8, 8, 8],
  // ];

  const sudokuGrid = [
    [9, 6, 0, 7, 0, 0, 0, 0, 5],
    [0, 0, 5, 0, 4, 0, 0, 7, 0],
    [0, 7, 4, 0, 0, 1, 2, 0, 8],
    [4, 0, 0, 0, 8, 2, 5, 1, 7],
    [7, 0, 0, 9, 0, 0, 0, 2, 4],
    [2, 0, 0, 4, 7, 5, 0, 3, 0],
    [5, 3, 0, 0, 9, 0, 7, 6, 0],
    [0, 4, 0, 0, 0, 0, 3, 8, 0],
    [0, 2, 0, 1, 0, 3, 0, 0, 0],
  ];

  const [current, setCurrent] = React.useState<[number, number] | undefined>();
  const [selected, setSelected] = React.useState<boolean[][]>(Array.from({ length: 9 }, () => Array(9).fill(false)));

  return (
    <div>
      <SudokuGrid
        presetGrid={sudokuGrid}
        // size={15}
        // regions={regions9}
        currentCell={current}
        selectedCells={selected}
        onSelectionChange={setSelected}
        onCurrentCellChange={setCurrent}
        onCellSelect={({ row, col }) => {
          // optional centralized hook
          console.log("Clicked:", row, col);
        }}
      />
    </div>
  );
}
