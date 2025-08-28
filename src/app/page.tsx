"use client";

import { SudokuGrid } from "@/components/sudoku/grid";
import React, { useRef, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Binary, Pencil, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColorName, SudokuGridHandle } from "@/types";
import { COLOR_BG_CLASS } from "@/components/sudoku/constants";

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
    [0, 0, 0, 1, 0, 2, 0, 0, 0],
    [0, 6, 0, 0, 0, 0, 0, 7, 0],
    [0, 0, 8, 0, 0, 0, 9, 0, 0],
    [4, 5, 0, 0, 0, 0, 0, 0, 3],
    [0, 0, 0, 0, 0, 7, 0, 0, 0],
    [2, 0, 0, 0, 8, 0, 0, 0, 1],
    [0, 0, 9, 0, 0, 0, 8, 0, 5],
    [0, 7, 0, 0, 0, 0, 0, 6, 0],
    [0, 0, 0, 3, 0, 4, 0, 0, 0],
  ];

  const [current, setCurrent] = useState<[number, number] | undefined>();
  const [selected, setSelected] = useState<boolean[][]>(Array.from({ length: 9 }, () => Array(9).fill(false)));
  const [notesMode, setNotesMode] = useState<"center" | "corner" | null>(null);

  // Ref to call imperative actions on the grid (e.g., annotateColor)
  const gridRef = useRef<SudokuGridHandle | null>(null);

  // Pastel color buttons (ordered as requested) - without black
  const COLOR_ORDER: ColorName[] = [
    "red",
    "orange",
    "yellow",
    "green",
    "cyan",
    "blue",
    "violet",
    "pink",
    "transparent",
  ];

  return (
    <div className="space-y-4 p-8">
      <SudokuGrid
        ref={gridRef}
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
      {/* Color annotation buttons (stateless actions) */}
      <div className="grid w-fit grid-cols-3 gap-1 rounded-md border p-2">
        {COLOR_ORDER.map((name) => (
          <Button
            key={name}
            variant="outline"
            aria-label={`Apply ${name} color to selection`}
            onClick={() => gridRef.current?.annotateColor(name)}
            title={`Toggle ${name} stripe`}
          >
            <span aria-hidden className={`size-5 rounded-xs border border-black/10 ${COLOR_BG_CLASS[name]}`} />
          </Button>
        ))}
        {/* Clear color button */}
        <Button
          variant="outline"
          aria-label="Clear color from selection"
          onClick={() => gridRef.current?.annotateClear()}
          title="Clear all stripes"
        >
          <Eraser />
        </Button>
      </div>
    </div>
  );
}
