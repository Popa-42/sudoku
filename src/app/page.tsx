// /src/app/page.tsx
"use client";

import { SudokuGrid } from "@/components/sudoku/grid";
import React, { useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Binary, Eraser, FileUp, FolderOpen, Paintbrush, Pencil, Save } from "lucide-react";
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
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Note = "center" | "corner" | "color" | null;

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
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  const [current, setCurrent] = useState<[number, number] | undefined>();
  const [selected, setSelected] = useState<boolean[][]>(Array.from({ length: 9 }, () => Array(9).fill(false)));
  const [notesMode, setNotesMode] = useState<Note>(null);

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

  // Upload dialog state and handlers
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadText, setUploadText] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadFileRef = useRef<HTMLInputElement | null>(null);
  const uploadTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

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

  // Helpers for Menubar actions
  const getExportState = () => gridRef.current?.exportState() ?? "";

  const downloadStringAsFile = (text: string, filename = "sudoku.sg1.txt") => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard?.writeText(text);
      return true;
    } catch (e) {
      console.error(e);
      alert("Failed to copy");
      return false;
    }
  };

  // Menubar item handlers
  const onMenuSaveFile = () => {
    const data = getExportState();
    if (!data) return;
    downloadStringAsFile(data);
  };

  const onMenuShareLink = async () => {
    const data = getExportState();
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set("state", data);
    await copyToClipboard(url.toString());
    alert("Share link copied to clipboard");
  };

  const onMenuCopyPayload = async () => {
    const data = getExportState();
    if (!data) return;
    await copyToClipboard(data);
  };

  const onMenuOpenFile = () => {
    setUploadOpen(true);
    // Open picker shortly after dialog mounts
    setTimeout(() => uploadFileRef.current?.click(), 0);
  };

  const onMenuPastePayload = () => {
    setUploadOpen(true);
    setTimeout(() => uploadTextAreaRef.current?.focus(), 0);
  };

  const onMenuReset = () => {
    gridRef.current?.reset();
  };

  const onMenuUndo = () => {
    gridRef.current?.undo();
  };

  const onMenuRedo = () => {
    gridRef.current?.redo();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return el.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKey = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e.target);
      // Global ctrl/cmd shortcuts
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        // Avoid interfering with text inputs
        if (editable) return;
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          onMenuSaveFile();
          return;
        }
        if (e.key === "o" || e.key === "O") {
          e.preventDefault();
          onMenuOpenFile();
          return;
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          onMenuReset();
          return;
        }
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          onMenuUndo();
          return;
        }
        if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          onMenuRedo();
          return;
        }
      }

      // Mode quick toggles (when not typing and no dialog taking focus)
      if (!editable && !uploadOpen && !exportOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "n" || e.key === "N") setNotesMode(null);
        if (e.key === "x" || e.key === "X") setNotesMode(notesMode === "center" ? null : "center");
        if (e.key === "c" || e.key === "C") setNotesMode(notesMode === "corner" ? null : "corner");
        if (e.key === "v" || e.key === "V") setNotesMode(notesMode === "color" ? null : "color");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadOpen, exportOpen, notesMode]);

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
    <div className="space-y-4 p-4">
      <Menubar className="w-fit">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarSub>
              <MenubarSubTrigger onClick={handleShare}>Save</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={onMenuSaveFile}>
                  Save file
                  <MenubarShortcut>
                    <kbd>Ctrl</kbd>
                    <kbd>S</kbd>
                  </MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={onMenuShareLink}>Share Link</MenubarItem>
                <MenubarItem onClick={onMenuCopyPayload}>Copy SG1 payload</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSub>
              <MenubarSubTrigger onClick={() => setUploadOpen(true)}>Open</MenubarSubTrigger>
              <MenubarSubContent>
                <MenubarItem onClick={onMenuOpenFile}>
                  Open file
                  <MenubarShortcut>
                    <kbd>Ctrl</kbd>
                    <kbd>O</kbd>
                  </MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={onMenuPastePayload}>Paste SG1 payload</MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            <MenubarSeparator />
            <MenubarItem onClick={onMenuReset}>
              Reset current puzzle
              <MenubarShortcut>
                <kbd>Ctrl</kbd>
                <kbd>R</kbd>
              </MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Edit</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={onMenuUndo}>
              Undo
              <MenubarShortcut>
                <kbd>Ctrl</kbd>
                <kbd>Z</kbd>
              </MenubarShortcut>
            </MenubarItem>
            <MenubarItem onClick={onMenuRedo}>
              Redo
              <MenubarShortcut>
                <kbd>Ctrl</kbd>
                <kbd>Y</kbd>
              </MenubarShortcut>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>View</MenubarTrigger>
          <MenubarContent>
            <MenubarRadioGroup value={notesMode || "normal"} onValueChange={(v) => setNotesMode(v as Note)}>
              <MenubarRadioItem value={"normal"}>
                Normal
                <MenubarShortcut>
                  <kbd>N</kbd>
                </MenubarShortcut>
              </MenubarRadioItem>
              <MenubarRadioItem value="center">
                Center Notes
                <MenubarShortcut>
                  <kbd>X</kbd>
                </MenubarShortcut>
              </MenubarRadioItem>
              <MenubarRadioItem value="corner">
                Corner Notes
                <MenubarShortcut>
                  <kbd>C</kbd>
                </MenubarShortcut>
              </MenubarRadioItem>
              <MenubarRadioItem value="color">
                Color Annotations
                <MenubarShortcut>
                  <kbd>V</kbd>
                </MenubarShortcut>
              </MenubarRadioItem>
            </MenubarRadioGroup>
            <MenubarSeparator />
            <MenubarCheckboxItem checked={isDark} onCheckedChange={(v) => setIsDark(v)}>
              Dark Mode
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
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

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
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
              ref={uploadTextAreaRef}
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
    </div>
  );
}
