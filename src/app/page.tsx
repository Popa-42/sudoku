// /src/app/page.tsx
"use client";

import { SudokuGrid } from "@/components/sudoku/grid";
import React, { useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Binary, ClipboardPaste, Eraser, FileUp, LinkIcon, Paintbrush, Pencil, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColorName, SudokuGridHandle } from "@/types";
import { COLOR_BG_CLASS, CORNER_POS_CLASSES } from "@/components/sudoku/constants";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

// Maps digits 1-9 to their keypad-like corner positions
const digitToCornerMap = {
  1: "tl",
  2: "tc",
  3: "tr",
  4: "lc",
  5: "cc",
  6: "rc",
  7: "bl",
  8: "bc",
  9: "br",
} as const;

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
    [4, 0, 0, 0, 0, 0, 0, 0, 3],
    [0, 5, 0, 0, 0, 7, 0, 0, 0],
    [2, 0, 0, 0, 8, 0, 0, 0, 1],
    [0, 0, 9, 0, 0, 0, 8, 0, 5],
    [0, 7, 0, 0, 0, 0, 0, 6, 0],
    [0, 0, 0, 3, 0, 4, 0, 0, 0],
  ];

  const [current, setCurrent] = useState<[number, number] | undefined>();
  const [selected, setSelected] = useState<boolean[][]>(Array.from({ length: 9 }, () => Array(9).fill(false)));
  const [notesMode, setNotesMode] = useState<"center" | "corner" | "color" | null>(null);

  // Ref to call imperative actions on the grid
  const gridRef = useRef<SudokuGridHandle | null>(null);

  useEffect(() => {
    tryImportFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Digits to display in numeric modes (maps across 10 buttons)
  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  const isColorMode = notesMode === "color";
  const isCenterMode = notesMode === "center";
  const isCornerMode = notesMode === "corner";

  const handleAdaptiveClick = (index: number) => {
    if (isColorMode) {
      if (index < COLOR_ORDER.length) {
        const color = COLOR_ORDER[index]!;
        gridRef.current?.annotateColor(color);
      } else {
        // 10th button in color mode = clear all stripes
        gridRef.current?.annotateClear();
      }
      return;
    }

    const d = DIGITS[index]!;

    if (isCenterMode) {
      if (d === 0) gridRef.current?.clearCenterNotes();
      else gridRef.current?.toggleCenterNote(d);
      return;
    }
    if (isCornerMode) {
      if (d === 0) gridRef.current?.clearCornerNotes();
      else gridRef.current?.toggleCornerNote(d);
      return;
    }

    // normal mode: set digit (0 clears)
    gridRef.current?.setDigit(d);
  };

  const handleShare = async () => {
    try {
      const data = gridRef.current?.exportState();
      if (!data) return;

      if (typeof navigator !== "undefined") {
        const nav = navigator as Navigator & {
          share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
        };
        if (typeof nav.share === "function") {
          try {
            await nav.share({ title: "Sudoku", text: data });
            return;
          } catch (_err) {
            // fall back
          }
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data);
        return;
      }

      const blob = new Blob([data], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "sudoku.sg1.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importFromText = (text: string) => {
    try {
      if (!text?.startsWith("SG1|")) throw new Error("Invalid payload");
      gridRef.current?.importState(text);
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "Failed to import");
    }
  };

  const handlePasteClick = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      importFromText(txt);
    } catch {
      const txt = prompt("Paste your SG1 payload here:");
      if (txt) importFromText(txt);
    }
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    importFromText(txt.trim());
    e.target.value = "";
  };

  const handleFileClick = () => fileInputRef.current?.click();

  const tryImportFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("state") || url.hash.replace(/^#state=/, "");
      if (!q) return;
      importFromText(decodeURIComponent(q));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 p-8">
      <SudokuGrid
        ref={gridRef}
        presetGrid={sudokuGrid}
        // size={15}
        // regions={regions9}
        pencilMode={notesMode === "center" ? "center" : notesMode === "corner" ? "corner" : null}
        currentCell={current}
        selectedCells={selected}
        onSelectionChange={setSelected}
        onCurrentCellChange={setCurrent}
        onCellSelect={({ row, col }) => {
          // optional centralized hook
          console.log("Clicked:", row, col);
        }}
      />

      <div className="flex w-fit flex-col gap-2 rounded-md border p-2">
        {/* Mode toggles */}
        <div className="flex gap-1">
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
          <Toggle
            variant="outline"
            aria-label="Toggle Color Annotation Mode"
            pressed={notesMode === "color"}
            onPressedChange={(value) => setNotesMode(value ? "color" : null)}
          >
            <Paintbrush />
          </Toggle>
        </div>

        <Separator />

        {/* Adaptive 10-button palette */}
        <div className="grid w-fit grid-cols-3 gap-1">
          {Array.from({ length: 10 }).map((_, idx) => {
            const isClearButtonInColor = isColorMode && idx === 9;
            const aria = isColorMode
              ? isClearButtonInColor
                ? "Clear color from selection"
                : `Apply ${COLOR_ORDER[idx]} color to selection`
              : isCenterMode
                ? `Toggle center note ${DIGITS[idx]}`
                : isCornerMode
                  ? `Toggle corner note ${DIGITS[idx]}`
                  : `Set digit ${DIGITS[idx]}`;

            const title = isColorMode
              ? isClearButtonInColor
                ? "Clear all stripes"
                : `Toggle ${COLOR_ORDER[idx]} stripe`
              : isCenterMode || isCornerMode
                ? DIGITS[idx] === 0
                  ? "Clear notes"
                  : `${isCenterMode ? "Center" : "Corner"} note ${DIGITS[idx]}`
                : DIGITS[idx] === 0
                  ? "Clear value"
                  : `Place ${DIGITS[idx]}`;

            const content = (() => {
              if (DIGITS[idx] === 0) return <Eraser />;
              if (isColorMode) {
                const color = COLOR_ORDER[idx]!;
                return (
                  <span
                    aria-hidden
                    className={`size-4 rounded-xs border border-foreground/10 ${COLOR_BG_CLASS[color]}`}
                  />
                );
              }

              const digit = DIGITS[idx]!;

              if (isCornerMode) {
                const posKey = digitToCornerMap[digit as keyof typeof digitToCornerMap];
                return (
                  <span
                    className={cn(
                      CORNER_POS_CLASSES[posKey],
                      "font-serif text-xxs leading-none font-semibold tracking-tight",
                    )}
                  >
                    {digit}
                  </span>
                );
              }

              // Center or Normal mode
              return <span className={isCenterMode ? "text-xs font-serif" : "text-base"}>{digit}</span>;
            })();

            return (
              <Button
                key={idx}
                size="icon"
                variant="outline"
                aria-label={aria}
                title={title}
                className={cn("relative", DIGITS[idx] === 0 ? "col-start-2" : undefined)}
                onClick={() => handleAdaptiveClick(idx)}
              >
                {content}
              </Button>
            );
          })}
        </div>

        <Separator />
      </div>

      <div className="flex w-fit gap-1 rounded-md border p-2">
        <Button
          size="icon"
          variant="outline"
          aria-label="Share / export grid"
          title="Share / export grid"
          onClick={handleShare}
        >
          <Share />
        </Button>

        <Button
          size="icon"
          variant="outline"
          aria-label="Import from clipboard / paste"
          title="Import from clipboard / paste"
          onClick={handlePasteClick}
        >
          <ClipboardPaste />
        </Button>

        <Button
          size="icon"
          variant="outline"
          aria-label="Import from file"
          title="Import from file"
          onClick={handleFileClick}
        >
          <FileUp />
        </Button>

        <input ref={fileInputRef} type="file" accept=".txt,.sg1" className="hidden" onChange={handleFilePick} />
      </div>
    </div>
  );
}
