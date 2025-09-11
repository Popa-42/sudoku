import type { Note } from "@/types";
import { useEffect, useState } from "react";

export function usePersistentDarkMode() {
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

export function useGlobalShortcuts(args: {
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

/*
 * useIsMobile
 * Returns true if the current viewport width is less than the provided rem threshold (default 48rem).
 * 48rem is commonly 768px when root font-size is 16px, but this hook computes based on the actual root font-size.
 */
export function useIsMobile(thresholdRem = 48) {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize || "16") || 16;
    return window.innerWidth < thresholdRem * rootSize;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    let frame: number | null = null;

    const evaluate = () => {
      frame = null;
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize || "16") || 16;
      const next = window.innerWidth < thresholdRem * rootSize;
      setIsMobile((prev) => (prev === next ? prev : next));
    };

    const onResize = () => {
      if (frame != null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(evaluate);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    // initial re-check in case hydration width differs
    onResize();

    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [thresholdRem]);

  return isMobile;
}
