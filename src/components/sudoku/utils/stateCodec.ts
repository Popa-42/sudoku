import { ColorName } from "@/types";
import { createDigitCube, createNumberGrid } from "@/components/sudoku/utils/grids";

export const SG1_HEADER = "SG1|" as const;

const COLOR_TO_CODE: Record<ColorName, string> = {
  red: "r",
  orange: "o",
  yellow: "y",
  green: "g",
  blue: "b",
  cyan: "c",
  violet: "v",
  pink: "p",
  transparent: "t",
};
const CODE_TO_COLOR: Record<string, ColorName> = Object.fromEntries(
  Object.entries(COLOR_TO_CODE).map(([name, code]) => [code, name as ColorName]),
) as Record<string, ColorName>;

export const to36 = (n: number) => n.toString(36);
export const from36 = (s: string) => parseInt(s, 36) || 0;

const maskWidthForSize = (size: number) => {
  const maxMask = Math.max(0, Math.pow(2, size) - 1);
  return Math.max(1, maxMask.toString(36).length);
};

export const SG1 = {
  encodeNumGrid(grid: number[][], size: number): string {
    const out: string[] = new Array(size * size);
    let i = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = grid?.[r]?.[c] ?? 0;
        if (v < 0 || v >= 36) throw new Error("Value out of encodable range (0..35)");
        out[i++] = to36(v);
      }
    }
    return out.join("");
  },

  decodeNumGrid(s: string, size: number): number[][] {
    const n = size * size;
    if (s.length !== n) throw new Error("Corrupt state: number grid length mismatch");
    const grid = createNumberGrid(size);
    for (let i = 0; i < n; i++) grid[Math.floor(i / size)][i % size] = from36(s[i]);
    return grid;
  },

  encodeDigitCube(cube: number[][][], size: number): { width: number; data: string } {
    const width = maskWidthForSize(size);
    const parts: string[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        let mask = 0;
        const cell = cube?.[r]?.[c];
        if (cell) for (let d = 1; d <= size; d++) if (cell[d]) mask |= 1 << (d - 1);
        parts.push(mask.toString(36).padStart(width, "0"));
      }
    }
    return { width, data: parts.join("") };
  },

  decodeDigitCube(payload: string, size: number): number[][][] {
    if (!payload) throw new Error("Corrupt state: empty cube payload");
    const width = from36(payload[0]);
    if (width < 1 || width > 10) throw new Error("Corrupt state: invalid mask width");
    const body = payload.slice(1);
    if (body.length !== size * size * width) throw new Error("Corrupt state: mask length mismatch");
    const cube = createDigitCube(size);
    let i = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const chunk = body.slice(i, i + width);
        i += width;
        const mask = parseInt(chunk, 36) || 0;
        for (let d = 1; d <= size; d++) cube[r][c][d] = (mask >> (d - 1)) & 1 ? 1 : 0;
      }
    }
    return cube;
  },

  encodeColors(grid: ColorName[][][], size: number): string {
    let out = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const list = grid?.[r]?.[c] ?? [];
        const payload = list.map((clr) => COLOR_TO_CODE[clr] ?? "").join("");
        if (payload.length >= 36) throw new Error("Too many color stripes in a cell (max 35)");
        out += to36(payload.length) + payload;
      }
    }
    return out;
  },

  decodeColors(s: string, size: number): ColorName[][][] {
    const grid: ColorName[][][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => [] as ColorName[]),
    );
    let i = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (i >= s.length) throw new Error("Corrupt state: truncated colors segment");
        const len = from36(s[i++]);
        const seg = s.slice(i, (i += len));
        const list: ColorName[] = [];
        for (let k = 0; k < seg.length; k++) {
          const clr = CODE_TO_COLOR[seg[k]];
          if (clr) list.push(clr);
        }
        grid[r][c] = list;
      }
    }
    return grid;
  },

  buildPayload(args: {
    size: number;
    preset: number[][];
    user: number[][];
    center: number[][][];
    corner: number[][][];
    colors: ColorName[][][];
    solution?: number[][]; // optional intended solution (same size)
  }): string {
    const { size, preset, user, center, corner, colors, solution } = args;
    const sizeStr = to36(size);
    const presetEnc = SG1.encodeNumGrid(preset, size);
    const userEnc = SG1.encodeNumGrid(user, size);
    const cCenter = SG1.encodeDigitCube(center, size);
    const cCorner = SG1.encodeDigitCube(corner, size);
    const colorsEnc = SG1.encodeColors(colors, size);
    const centerSeg = to36(cCenter.width) + cCenter.data;
    const cornerSeg = to36(cCorner.width) + cCorner.data;
    const parts = ["SG1", sizeStr, presetEnc, userEnc, centerSeg, cornerSeg, colorsEnc];
    if (solution) {
      parts.push(SG1.encodeNumGrid(solution, size));
    }
    parts.push(""); // trailing empty for easier appending of future segments
    return parts.join("|");
  },
};

/* =========================================================
   Optional metadata (title/rules) export
   Format: M1<flags>|base64url(payload)
   flags bit0=compressed (gzip)
   payload: UTF-8 JSON {t,r} possibly gzip-compressed
   ========================================================= */

function b64urlEncode(bytes: Uint8Array): string {
  const bin = String.fromCharCode(...bytes);
  const b64 = btoa(bin);
  return b64.replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function maybeGzip(data: Uint8Array): Promise<{ bytes: Uint8Array; compressed: boolean }> {
  if (typeof CompressionStream === "undefined") return { bytes: data, compressed: false };
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const cs = new CompressionStream("gzip");
  const res = new Response(new Blob([ab]).stream().pipeThrough(cs));
  const buf = await res.arrayBuffer();
  const out = new Uint8Array(buf);
  if (out.length < data.length) return { bytes: out, compressed: true };
  return { bytes: data, compressed: false };
}

export async function encodeMeta(meta: { title: string; rules: string }): Promise<string> {
  const json = JSON.stringify({ t: meta.title ?? "", r: meta.rules ?? "" });
  const raw = new TextEncoder().encode(json);
  const { bytes, compressed } = await maybeGzip(raw);
  const flags = compressed ? 1 : 0;
  return `M1${String.fromCharCode(flags)}|${b64urlEncode(bytes)}`;
}

export async function decodeMeta(seg: string): Promise<{ title: string; rules: string } | null> {
  if (!seg || seg.length < 4 || seg[0] !== "M" || seg[1] !== "1") return null;
  const flags = seg.charCodeAt(2) || 0;
  const parts = seg.split("|");
  const dataB64 = parts[1] ?? "";
  if (!dataB64) return null;

  let data: Uint8Array;
  try {
    // base64url decode
    const pad = dataB64.length % 4 ? 4 - (dataB64.length % 4) : 0;
    const base64 = (dataB64 + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(base64);
    data = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  } catch {
    return null;
  }

  const compressed = (flags & 1) !== 0;
  if (compressed) {
    if (typeof DecompressionStream === "undefined") return null;
    try {
      const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const ds = new DecompressionStream("gzip");
      const res = new Response(new Blob([ab]).stream().pipeThrough(ds));
      const buf = await res.arrayBuffer();
      data = new Uint8Array(buf);
    } catch {
      return null;
    }
  }

  try {
    const txt = new TextDecoder().decode(data);
    const obj = JSON.parse(txt) as { t?: string; r?: string };
    return { title: obj.t ?? "", rules: obj.r ?? "" };
  } catch {
    return null;
  }
}
