// /src/app/page.tsx
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { SudokuGrid } from "@/components/sudoku/grid";
import type { ColorName, Note, SudokuGridHandle } from "@/types";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { COLOR_BG_CLASS, CORNER_POS_CLASSES } from "@/components/sudoku/constants";
import { Binary, Eraser, Paintbrush, Pencil } from "lucide-react";
import { decodeMeta, encodeMeta, SG1_HEADER } from "@/components/sudoku/utils/stateCodec";
import AppMenubar from "@/components/app-menubar";
import { ExportDialog, UploadDialog } from "@/components/dialogs";
import { useGlobalShortcuts, usePersistentDarkMode } from "@/hooks/basic";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

/* =========================
   Types & constants
   ========================= */

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
  const [editorialMode, setEditorialMode] = useState(false);
  const [title, setTitle] = useState("");
  const [rules, setRules] = useState("");

  const gridRef = useRef<SudokuGridHandle | null>(null);

  // dialogs
  const [uploadOpen, setUploadOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportText, setExportText] = useState("");

  const { isDark, setIsDark } = usePersistentDarkMode();

  // Build export with optional compact metadata (M1)
  const buildExport = useCallback(async (): Promise<string> => {
    const base = gridRef.current?.exportState() ?? "";
    if (!base) return base;
    if (!(title || rules)) return base;
    try {
      const seg = await encodeMeta({ title, rules });
      return (base.endsWith("|") ? base : base + "|") + seg;
    } catch (e) {
      console.warn("Failed to encode metadata segment", e);
      return base;
    }
  }, [title, rules]);

  // share via dialog
  const handleShare = useCallback(async () => {
    const data = await buildExport();
    if (!data) return;
    setExportText(data);
    setExportOpen(true);
  }, [buildExport]);

  // import helpers
  const importFromText = useCallback(async (text: string): Promise<boolean> => {
    if (!text?.startsWith(SG1_HEADER)) {
      alert("Invalid payload");
      return false;
    }
    try {
      gridRef.current?.importState(text);

      // Always reset metadata first, then try to decode if found
      setTitle("");
      setRules("");

      // Attempt to decode optional M1 metadata and populate title/rules
      const parts = text.split("|");
      for (let i = 0; i < parts.length - 1; i++) {
        const tag = parts[i];
        const body = parts[i + 1];
        if (tag && tag.startsWith("M1") && body) {
          const meta = await decodeMeta(`${tag}|${body}`);
          if (meta) {
            setTitle(meta.title || "");
            setRules(meta.rules || "");
          }
          break;
        }
      }

      return true;
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "Failed to import");
      return false;
    }
  }, []);

  // try import from URL once
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        let raw: string | null = null;
        let cameFrom: "search" | "hash" | null = null;

        if (url.searchParams.has("state")) {
          raw = url.searchParams.get("state");
          cameFrom = "search";
        } else if (/^#state=/.test(url.hash)) {
          raw = url.hash.replace(/^#state=/, "");
          cameFrom = "hash";
        }
        if (!raw) return;

        const decoded = decodeURIComponent(raw);
        const ok = await importFromText(decoded);
        if (ok) {
          // Remove the state indicator from the URL without adding a history entry
          if (cameFrom === "search") {
            url.searchParams.delete("state");
            const remaining = url.searchParams.toString();
            const clean = remaining ? `${url.pathname}?${remaining}` : url.pathname;
            window.history.replaceState(null, "", clean);
          } else if (cameFrom === "hash") {
            window.history.replaceState(null, "", url.pathname + (url.search ? url.search : ""));
          }
        }
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!expertMode) {
      setEditorialMode(false);
    }
  }, [expertMode]);

  // menu helpers
  const getExportState = useCallback(() => gridRef.current?.exportState() ?? "", []);
  const onMenuSaveFile = useCallback(async () => {
    const data = await buildExport();
    if (!data) return;
    downloadStringAsFile(data);
  }, [buildExport]);
  const onMenuShareLink = useCallback(async () => {
    const data = await buildExport();
    if (!data) return;
    const url = new URL(window.location.href);
    url.searchParams.set("state", data);
    await copyToClipboard(url.toString());
    alert("Share link copied to clipboard");
  }, [buildExport]);
  const onMenuCopyPayload = useCallback(async () => {
    const data = await buildExport();
    if (!data) return;
    await copyToClipboard(data);
  }, [buildExport]);
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
      <AppMenubar
        expertMode={expertMode}
        setExpertMode={setExpertMode}
        isDark={isDark}
        setIsDark={setIsDark}
        notesMode={notesMode}
        setNotesMode={setNotesMode}
        onMenuUndo={onMenuUndo}
        onMenuRedo={onMenuRedo}
        onMenuReset={onMenuReset}
        onMenuSaveFile={onMenuSaveFile}
        onMenuShareLink={onMenuShareLink}
        onMenuOpenFile={onMenuOpenFile}
        onMenuCopyPayload={onMenuCopyPayload}
        onMenuPastePayload={onMenuPastePayload}
        setUploadOpen={setUploadOpen}
        handleShare={handleShare}
        editorialMode={editorialMode}
        setEditorialMode={setEditorialMode}
      />

      <div className="flex w-fit flex-col gap-4 md:flex-row">
        <SudokuGrid
          ref={gridRef}
          pencilMode={
            notesMode === "center"
              ? "center"
              : notesMode === "corner"
                ? "corner"
                : notesMode === "color"
                  ? "color"
                  : null
          }
          currentCell={current}
          selectedCells={selected}
          onSelectionChange={setSelected}
          onCurrentCellChange={setCurrent}
          editorialMode={editorialMode}
          onCellSelect={({ row, col }) => {
            console.log("Clicked:", row, col);
          }}
        />
        {editorialMode ? (
          <div className="flex flex-col gap-2 md:w-72">
            <Input
              placeholder="Sudoku Title"
              className="w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Enter ruleset here…"
              className="w-full text-justify break-words whitespace-pre-wrap md:h-full"
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
          </div>
        ) : (
          (title || rules) && (
            <div
              className={`
                flex size-fit max-w-90.5 flex-col rounded-md border px-3 py-2 text-justify text-sm break-words
                hyphens-auto whitespace-pre-wrap
                md:w-72
              `}
            >
              {title && <h3 className="not-last:mb-1">{title}</h3>}
              <span>{rules}</span>
            </div>
          )
        )}
      </div>

      <div className="flex w-fit flex-col gap-2 rounded-md border p-2">
        <ModeToggles mode={notesMode} setMode={setNotesMode} />
        <Separator />
        <AdaptivePalette mode={notesMode} onClick={handleAdaptiveClick} />
        <Separator />
        <Button
          variant="secondary"
          onClick={() => {
            const valid = gridRef.current?.isValid();
            alert(valid ? "No conflicts found" : "Conflicts detected");
          }}
        >
          Check Sudoku
        </Button>
      </div>

      <UploadDialog
        open={uploadOpen}
        setOpen={setUploadOpen}
        onImportText={(txt) => {
          importFromText(txt).then();
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
