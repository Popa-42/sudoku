import React from "react";
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
import { Note } from "@/types";

export default function AppMenubar({
  expertMode,
  setExpertMode,
  isDark,
  setIsDark,
  notesMode,
  setNotesMode,
  onMenuUndo,
  onMenuRedo,
  onMenuReset,
  onMenuSaveFile,
  onMenuShareLink,
  onMenuOpenFile,
  onMenuCopyPayload,
  onMenuPastePayload,
  setUploadOpen,
  handleShare,
  editorialMode,
  setEditorialMode,
}: {
  expertMode: boolean;
  setExpertMode: (v: boolean) => void;
  isDark: boolean;
  setIsDark: (v: boolean) => void;
  notesMode: Note | null;
  setNotesMode: (v: Note) => void;
  onMenuUndo: () => void;
  onMenuRedo: () => void;
  onMenuReset: () => void;
  onMenuSaveFile: () => void;
  onMenuShareLink: () => void;
  onMenuOpenFile: () => void;
  onMenuCopyPayload: () => void;
  onMenuPastePayload: () => void;
  setUploadOpen: (v: boolean) => void;
  handleShare: () => void;
  editorialMode: boolean;
  setEditorialMode: (v: boolean) => void;
}) {
  return (
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
              <MenubarCheckboxItem checked={editorialMode} onCheckedChange={(v) => setEditorialMode(v)}>
                Editorial Mode
              </MenubarCheckboxItem>
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
  );
}
