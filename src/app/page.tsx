"use client";

import SudokuGrid from "@/components/sudoku/grid";
import React, { useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Binary, Pencil } from "lucide-react";

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

  const [current, setCurrent] = useState<[number, number] | undefined>();
  const [selected, setSelected] = useState<boolean[][]>(Array.from({ length: 9 }, () => Array(9).fill(false)));
  const [notesMode, setNotesMode] = useState<"center" | "corner" | null>(null);

  return (
    <div className="space-y-4 p-8">
      <SudokuGrid
        presetGrid={sudokuGrid}
        // size={15}
        // regions={regions9}
        pencilMode={notesMode}
        currentCell={current}
        selectedCells={selected}
        onSelectionChange={setSelected}
        onCurrentCellChange={setCurrent}
        onCellSelect={({ row, col }) => {
          // optional centralized hook
          console.log("Clicked:", row, col);
        }}
      />
      <div className="flex gap-2 rounded-md border p-2">
        <Toggle
          variant="outline"
          aria-label="Toggle Center Notes Mode"
          pressed={notesMode === "center"}
          onPressedChange={(value) => setNotesMode(value ? "center" : null)}
        >
          <Pencil />
        </Toggle>
        <Toggle
          variant="outline"
          aria-label="Toggle Corner Notes Mode"
          pressed={notesMode === "corner"}
          onPressedChange={(value) => setNotesMode(value ? "corner" : null)}
        >
          <Binary />
        </Toggle>
      </div>
    </div>
  );
}
