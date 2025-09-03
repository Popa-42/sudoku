// /src/app/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SudokuGrid } from "@/components/sudoku/grid";
import type { ColorName, SudokuGridHandle } from "@/types";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { COLOR_BG_CLASS, CORNER_POS_CLASSES } from "@/components/sudoku/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Binary, Eraser, FileUp, Paintbrush, Pencil } from "lucide-react";
import { SG1_HEADER } from "@/components/sudoku/utils/stateCodec";

/* =========================
   Types & constants
   ========================= */

type Note = "center" | "corner" | "color" | null;

const COLOR_ORDER: ColorName[] = ["red", "orange", "yellow", "green", "cyan", "blue", "violet", "pink", "transparent"];

// keypad layout for corner notes
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const;
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

/* =========================
   Small hooks
   ========================= */

function usePersistentDarkMode() {
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

  return { isDark, setIsDark };
}

function useGlobalShortcuts(args: {
  uploadOpen: boolean;
  exportOpen: boolean;
  notesMode: Note;
  setNotesMode: (m: Note) => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  openUploadDialog: () => void;
  saveFile: () => void;
  openFile: () => void;
}) {
  const {
    uploadOpen,
    exportOpen,
    notesMode,
    setNotesMode,
    onReset,
    onUndo,
    onRedo,
    openUploadDialog,
    saveFile,
    openFile,
  } = args;

  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return el.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKey = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e.target);

      if (e.ctrlKey || e.metaKey) {
        if (!e.shiftKey && !e.altKey) {
          if (editable) return;
          if (e.key === "o" || e.key === "O") {
            e.preventDefault();
            openUploadDialog();
            return;
          }
          if (e.key === "r" || e.key === "R") {
            e.preventDefault();
            onReset();
            return;
          }
          if (e.key === "z" || e.key === "Z") {
            e.preventDefault();
            onUndo();
            return;
          }
          if (e.key === "y" || e.key === "Y") {
            e.preventDefault();
            onRedo();
            return;
          }
        } else if (e.shiftKey && !e.altKey) {
          if (e.key === "s" || e.key === "S") {
            e.preventDefault();
            saveFile();
            return;
          }
          if (e.key === "o" || e.key === "O") {
            e.preventDefault();
            openFile();
            return;
          }
        }
      }

      if (!editable && !uploadOpen && !exportOpen && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "n" || e.key === "N") setNotesMode(null);
        if (e.key === "x" || e.key === "X") setNotesMode(notesMode === "center" ? null : "center");
        if (e.key === "c" || e.key === "C") setNotesMode(notesMode === "corner" ? null : "corner");
        if (e.key === "v" || e.key === "V") setNotesMode(notesMode === "color" ? null : "color");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [uploadOpen, exportOpen, notesMode, setNotesMode, onReset, onUndo, onRedo, openUploadDialog, saveFile, openFile]);
}

/* =========================
   Small helpers
   ========================= */

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch (e) {
    console.error(e);
    alert("Failed to copy");
    return false;
  }
}

function downloadStringAsFile(text: string, filename = "sudoku.sg1.txt") {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   Dialog components
   ========================= */

function UploadDialog(props: { open: boolean; setOpen: (v: boolean) => void; onImportText: (text: string) => void }) {
  const { open, setOpen, onImportText } = props;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const onFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = (await f.text()).trim();
    setText(txt);
    setError(null);
    e.target.value = "";
  };

  const onSend = () => {
    const txt = text.trim();
    if (!txt) {
      setError("Please paste a state or choose a file.");
      return;
    }
    if (!txt.startsWith(SG1_HEADER)) {
      setError(`Invalid payload. Expected text starting with ${SG1_HEADER}`);
      return;
    }
    setError(null);
    onImportText(txt);
    setOpen(false);
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload sudoku state</DialogTitle>
          <DialogDescription>Paste your SG1 payload or choose a file from your device.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="sg1">Sudoku state</Label>
          <Textarea
            id="sg1"
            placeholder={`${SG1_HEADER}...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={error ? true : undefined}
            spellCheck={false}
            ref={textRef}
          />
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Tip: payload should start with {SG1_HEADER}</p>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} type="button">
              <FileUp size={12} /> Choose file
            </Button>
            <input ref={fileRef} type="file" accept=".txt,.sg1" className="hidden" onChange={onFilePick} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            Cancel
          </Button>
          <Button onClick={onSend} type="button">
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExportDialog(props: {
  open: boolean;
  setOpen: (v: boolean) => void;
  text: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  const { open, setOpen, text, onCopy, onDownload } = props;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export sudoku state</DialogTitle>
          <DialogDescription>Copy or download your SG1 payload.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="sg1-out">Sudoku state</Label>
          <Textarea id="sg1-out" value={text} readOnly spellCheck={false} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} type="button">
            Close
          </Button>
          <Button variant="secondary" onClick={onCopy} type="button">
            Copy
          </Button>
          <Button onClick={onDownload} type="button">
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   UI fragments
   ========================= */

function ModeToggles(props: { mode: Note; setMode: (m: Note) => void }) {
  const { mode, setMode } = props;
  return (
    <div className="flex gap-1">
      <Toggle
        variant="outline"
        aria-label="Toggle Center Notes Mode"
        title="Center Notes Mode (X)"
        pressed={mode === "center"}
        onPressedChange={(value) => setMode(value ? "center" : null)}
      >
        <span className="sr-only">Center Notes</span>
        <Pencil />
      </Toggle>
      <Toggle
        variant="outline"
        aria-label="Toggle Corner Notes Mode"
        title="Corner Notes Mode (C)"
        pressed={mode === "corner"}
        onPressedChange={(value) => setMode(value ? "corner" : null)}
      >
        <span className="sr-only">Corner Notes</span>
        <Binary />
      </Toggle>
      <Toggle
        variant="outline"
        aria-label="Toggle Color Annotation Mode"
        title="Color Annotation Mode (V)"
        pressed={mode === "color"}
        onPressedChange={(value) => setMode(value ? "color" : null)}
      >
        <span className="sr-only">Color Annotations</span>
        <Paintbrush />
      </Toggle>
    </div>
  );
}

function AdaptivePalette(props: { mode: Note; onClick: (index: number) => void }) {
  const { mode, onClick } = props;
  const isColor = mode === "color";
  const isCenter = mode === "center";
  const isCorner = mode === "corner";

  return (
    <div className="grid w-fit grid-cols-3 gap-1">
      {Array.from({ length: 10 }).map((_, idx) => {
        const digit = DIGITS[idx]!;
        const isClearButtonInColor = isColor && idx === 9;

        const aria = isColor
          ? isClearButtonInColor
            ? "Clear color from selection"
            : `Apply ${COLOR_ORDER[idx]} color to selection`
          : isCenter
            ? `Toggle center note ${digit}`
            : isCorner
              ? `Toggle corner note ${digit}`
              : `Set digit ${digit}`;

        const title = isColor
          ? isClearButtonInColor
            ? "Clear all colors"
            : `Toggle ${COLOR_ORDER[idx]} color`
          : isCenter || isCorner
            ? digit === 0
              ? "Clear notes"
              : `${isCenter ? "Center" : "Corner"} note ${digit}`
            : digit === 0
              ? "Clear value"
              : `Place ${digit}`;

        const content = (() => {
          if (digit === 0)
            return (
              <>
                <span className="sr-only">Clear</span>
                <Eraser />
              </>
            );

          if (isColor) {
            const color = COLOR_ORDER[idx]!;
            return (
              <span
                aria-hidden
                className={cn("size-4 rounded-xs border border-foreground/10", COLOR_BG_CLASS[color])}
              />
            );
          }

          if (isCorner) {
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

          return <span className={isCenter ? "text-xs font-serif" : "text-base"}>{digit}</span>;
        })();

        return (
          <Button
            key={idx}
            size="icon"
            variant="outline"
            aria-label={aria}
            title={title}
            className={cn("relative", digit === 0 ? "col-start-2" : undefined)}
            onClick={() => onClick(idx)}
          >
            {content}
          </Button>
        );
      })}
    </div>
  );
}

/* =========================
   Page
   ========================= */

export default function Home() {
  const [current, setCurrent] = useState<[number, number] | undefined>();
  const [selected, setSelected] = useState<boolean[][]>(Array.from({ length: 9 }, () => Array(9).fill(false)));
  const [notesMode, setNotesMode] = useState<Note>(null);
  const [expertMode, setExpertMode] = useState(false);

  const gridRef = useRef<SudokuGridHandle | null>(null);

  // dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportText, setExportText] = useState("");

  const { isDark, setIsDark } = usePersistentDarkMode();

  // share via dialog
  const handleShare = useCallback(() => {
    const data = gridRef.current?.exportState();
    if (!data) return;
    setExportText(data);
    setExportOpen(true);
  }, []);

  // import helpers
  const importFromText = useCallback((text: string): boolean => {
    if (!text?.startsWith(SG1_HEADER)) {
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
  }, []);

  // try import from URL once
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("state") || url.hash.replace(/^#state=/, "");
      if (!q) return;
      importFromText(decodeURIComponent(q));
    } catch (e) {
      console.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // menu helpers
  const getExportState = useCallback(() => gridRef.current?.exportState() ?? "", []);
  const onMenuSaveFile = useCallback(() => {
    const data = getExportState();
    if (!data) return;
    downloadStringAsFile(data);
  }, [getExportState]);
  const onMenuShareLink = useCallback(async () => {
    const data = getExportState();
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set("state", data);
    await copyToClipboard(url.toString());
    alert("Share link copied to clipboard");
  }, [getExportState]);
  const onMenuCopyPayload = useCallback(async () => {
    const data = getExportState();
    if (!data) return;
    await copyToClipboard(data);
  }, [getExportState]);
  const onMenuOpenFile = useCallback(() => {
    setUploadOpen(true);
    setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('input[type="file"][accept=".txt,.sg1"]');
      el?.click();
    }, 0);
  }, []);
  const onMenuPastePayload = useCallback(() => {
    setUploadOpen(true);
    setTimeout(() => {
      const el = document.getElementById("sg1") as HTMLTextAreaElement | null;
      el?.focus();
    }, 0);
  }, []);
  const onMenuReset = useCallback(() => gridRef.current?.reset(), []);
  const onMenuUndo = useCallback(() => gridRef.current?.undo(), []);
  const onMenuRedo = useCallback(() => gridRef.current?.redo(), []);

  // global shortcuts
  useGlobalShortcuts({
    uploadOpen,
    exportOpen,
    notesMode,
    setNotesMode,
    onReset: onMenuReset,
    onUndo: onMenuUndo,
    onRedo: onMenuRedo,
    openUploadDialog: () => setUploadOpen(true),
    saveFile: onMenuSaveFile,
    openFile: onMenuOpenFile,
  });

  // adaptive palette click
  const handleAdaptiveClick = useCallback(
    (index: number) => {
      const isColorMode = notesMode === "color";
      const isCenterMode = notesMode === "center";
      const isCornerMode = notesMode === "corner";

      if (isColorMode) {
        if (index < COLOR_ORDER.length) {
          const color = COLOR_ORDER[index]!;
          gridRef.current?.annotateColor(color);
        } else {
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
      gridRef.current?.setDigit(d);
    },
    [notesMode],
  );

  // export dialog actions
  const handleExportCopy = useCallback(async () => {
    await copyToClipboard(exportText);
  }, [exportText]);
  const handleExportDownload = useCallback(() => downloadStringAsFile(exportText), [exportText]);

  return (
    <div className="space-y-4 p-4">
      <Menubar className="w-fit">
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            {expertMode ? (
              <>
                <MenubarSub>
                  <MenubarSubTrigger>Save...</MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarItem onClick={handleShare}>
                      Show saving dialog
                      <MenubarShortcut>
                        <kbd>Ctrl</kbd>
                        <kbd>S</kbd>
                      </MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem onClick={onMenuSaveFile}>
                      Save file
                      <MenubarShortcut>
                        <kbd>Ctrl</kbd>
                        <kbd>Shift</kbd>
                        <kbd>S</kbd>
                      </MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem onClick={onMenuShareLink}>Share link</MenubarItem>
                    {expertMode && <MenubarItem onClick={onMenuCopyPayload}>Copy SG1 payload</MenubarItem>}
                  </MenubarSubContent>
                </MenubarSub>
                <MenubarSub>
                  <MenubarSubTrigger>Open...</MenubarSubTrigger>
                  <MenubarSubContent>
                    <MenubarItem onClick={() => setUploadOpen(true)}>
                      Show opening dialog
                      <MenubarShortcut>
                        <kbd>Ctrl</kbd>
                        <kbd>O</kbd>
                      </MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem onClick={onMenuOpenFile}>
                      Open file
                      <MenubarShortcut>
                        <kbd>Ctrl</kbd>
                        <kbd>Shift</kbd>
                        <kbd>O</kbd>
                      </MenubarShortcut>
                    </MenubarItem>
                    <MenubarItem onClick={onMenuPastePayload}>Paste SG1 payload</MenubarItem>
                  </MenubarSubContent>
                </MenubarSub>
              </>
            ) : (
              <>
                <MenubarItem onClick={handleShare}>
                  Save
                  <MenubarShortcut>
                    <kbd>Ctrl</kbd>
                    <kbd>S</kbd>
                  </MenubarShortcut>
                </MenubarItem>
                <MenubarItem onClick={() => setUploadOpen(true)}>
                  Open
                  <MenubarShortcut>
                    <kbd>Ctrl</kbd>
                    <kbd>O</kbd>
                  </MenubarShortcut>
                </MenubarItem>
              </>
            )}
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
            <MenubarItem inset onClick={onMenuUndo}>
              Undo
              <MenubarShortcut>
                <kbd>Ctrl</kbd>
                <kbd>Z</kbd>
              </MenubarShortcut>
            </MenubarItem>
            <MenubarItem inset onClick={onMenuRedo}>
              Redo
              <MenubarShortcut>
                <kbd>Ctrl</kbd>
                <kbd>Y</kbd>
              </MenubarShortcut>
            </MenubarItem>
            {expertMode && (
              <>
                <MenubarSeparator />
                <MenubarCheckboxItem disabled>Editorial Mode</MenubarCheckboxItem>
              </>
            )}
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
            <MenubarSeparator />
            <MenubarCheckboxItem checked={expertMode} onCheckedChange={(v) => setExpertMode(v)}>
              Expert Mode
            </MenubarCheckboxItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      <SudokuGrid
        ref={gridRef}
        pencilMode={notesMode === "center" ? "center" : notesMode === "corner" ? "corner" : null}
        currentCell={current}
        selectedCells={selected}
        onSelectionChange={setSelected}
        onCurrentCellChange={setCurrent}
        onCellSelect={({ row, col }) => {
          console.log("Clicked:", row, col);
        }}
      />

      <div className="flex w-fit flex-col gap-2 rounded-md border p-2">
        <ModeToggles mode={notesMode} setMode={setNotesMode} />
        <Separator />
        <AdaptivePalette mode={notesMode} onClick={handleAdaptiveClick} />
      </div>

      <UploadDialog
        open={uploadOpen}
        setOpen={setUploadOpen}
        onImportText={(txt) => {
          importFromText(txt);
        }}
      />

      <ExportDialog
        open={exportOpen}
        setOpen={setExportOpen}
        text={exportText}
        onCopy={handleExportCopy}
        onDownload={handleExportDownload}
      />
    </div>
  );
}
