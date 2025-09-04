import React, { useRef, useState } from "react";
import { SG1_HEADER } from "@/components/sudoku/utils/stateCodec";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileUp } from "lucide-react";

export function UploadDialog(props: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onImportText: (text: string) => void;
}) {
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

export function ExportDialog(props: {
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
