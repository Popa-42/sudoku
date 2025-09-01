// /src/app/page.tsx
"use client";

import { SudokuGrid } from "@/components/sudoku/grid";
import React, { useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Binary, ClipboardPaste, Eraser, FileUp, Paintbrush, Pencil, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ColorName, SudokuGridHandle } from "@/types";
import { COLOR_BG_CLASS, CORNER_POS_CLASSES } from "@/components/sudoku/constants";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

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
      setExportText(data);
      setExportOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  // Import helpers
  const importFromText = (text: string): boolean => {
    if (!text?.startsWith("SG1|")) {
      alert("Invalid payload");
      return false;
    }
    try {
      gridRef.current?.importState(text);
      return true;
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "Failed to import");
      return false;
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

  // Upload dialog state and handlers
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadFileRef = useRef<HTMLInputElement | null>(null);

  const handleDialogFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = (await f.text()).trim();
    setUploadText(txt);
    setUploadError(null);
    e.target.value = "";
  };

  const handleDialogFileClick = () => uploadFileRef.current?.click();

  const handleDialogSend = () => {
    const txt = uploadText.trim();
    if (!txt) {
      setUploadError("Please paste a state or choose a file.");
      return;
    }
    if (!txt.startsWith("SG1|")) {
      setUploadError("Invalid payload. Expected text starting with SG1|.");
      return;
    }
    setUploadError(null);
    importFromText(txt);
    setUploadOpen(false);
    setUploadText("");
  };

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

  // Export dialog state and handlers
  const [exportOpen, setExportOpen] = useState(false);
  const [exportText, setExportText] = useState("");

  const handleExportCopy = async () => {
    try {
      await navigator.clipboard?.writeText(exportText);
    } catch (e) {
      console.error(e);
      alert("Failed to copy");
    }
  };

  const handleExportDownload = () => {
    try {
      const blob = new Blob([exportText], { type: "text/plain" });
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

  // Dark mode state
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
      const prefersDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const next = saved ? saved === "dark" : !!prefersDark;
      setIsDark(next);
      if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", next);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", isDark);
      if (typeof window !== "undefined") localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {}
  }, [isDark]);

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
      </div>

      <div className="flex w-fit items-center gap-1 rounded-md border p-2">
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

        {/* Upload dialog */}
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Upload" title="Upload">
              <FileUp />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload sudoku state</DialogTitle>
              <DialogDescription>Paste your SG1 payload or choose a file from your device.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="sg1">Sudoku state</Label>
              <Textarea
                id="sg1"
                placeholder="SG1|..."
                value={uploadText}
                onChange={(e) => setUploadText(e.target.value)}
                aria-invalid={uploadError ? true : undefined}
                spellCheck={false}
              />
              {uploadError ? (
                <p className="text-sm text-destructive">{uploadError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Tip: payload should start with SG1|</p>
              )}

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleDialogFileClick} type="button">
                  <FileUp className="mr-2" /> Choose file
                </Button>
                <input
                  ref={uploadFileRef}
                  type="file"
                  accept=".txt,.sg1"
                  className="hidden"
                  onChange={handleDialogFilePick}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadOpen(false)} type="button">
                Cancel
              </Button>
              <Button onClick={handleDialogSend} type="button">
                Send
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export dialog */}
        <Dialog open={exportOpen} onOpenChange={setExportOpen}>
          {/* Share button already opens dialog via handleShare */}
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export sudoku state</DialogTitle>
              <DialogDescription>Copy or download your SG1 payload.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Label htmlFor="sg1-out">Sudoku state</Label>
              <Textarea id="sg1-out" value={exportText} readOnly spellCheck={false} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setExportOpen(false)} type="button">
                Close
              </Button>
              <Button variant="secondary" onClick={handleExportCopy} type="button">
                Copy
              </Button>
              <Button onClick={handleExportDownload} type="button">
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dark mode toggle */}
        <div className="ml-2 flex items-center gap-2">
          <Label htmlFor="dark-switch" className="text-xs">
            Dark
          </Label>
          <Switch id="dark-switch" checked={isDark} onCheckedChange={(v) => setIsDark(v)} />
        </div>
      </div>
    </div>
  );
}
