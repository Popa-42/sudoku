import React from "react";
import { cn } from "@/lib/utils";

type RectBox = { rows: number; cols: number };

type SudokuGridProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number;
  grid?: number[][];
  box?: RectBox; // Optional rectangular sub-box layout
  regions?: number[][]; // Optional region map (overrides `box` if provided)
  cellClassName?: string; // Optional per-cell class
  dividerClassName?: string; // Class used for thick borders (e.g., color/width)
};

function SudokuGrid({
  size = 9,
  className,
  grid,
  box,
  regions,
  cellClassName,
  dividerClassName = "border-foreground", // color class for thick borders
  ...props
}: SudokuGridProps) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error("Size must be a positive integer.");
  }

  // Default rectangular boxes (e.g., 3x3 for 9)
  const defaultBox = (() => {
    if (size === 9) return { rows: 3, cols: 3 };
    const r = Math.floor(Math.sqrt(size));
    if (r > 1 && size % r === 0) return { rows: r, cols: size / r };
    return { rows: size, cols: 1 };
  })();

  const activeBox = box ?? defaultBox;

  if (regions) {
    if (regions.length !== size || regions.some((row) => row.length !== size)) {
      throw new Error('Invalid "regions": expected a size×size matrix.');
    }
  }

  const regionIdAt = (r: number, c: number): number => {
    if (regions) return regions[r][c];
    const boxRow = Math.floor(r / activeBox.rows);
    const boxCol = Math.floor(c / activeBox.cols);
    return boxRow * Math.ceil(size / activeBox.cols) + boxCol;
  };

  const cellBorderClasses = (r: number, c: number) => {
    const base = ["h-10", "w-10", "border", "border-foreground", "text-center"];
    const thick: string[] = [];

    if (regions) {
      const id = regionIdAt(r, c);
      const topChange = r === 0 || regionIdAt(r - 1, c) !== id;
      const leftChange = c === 0 || regionIdAt(r, c - 1) !== id;
      const rightChange = c === size - 1 || regionIdAt(r, c + 1) !== id;
      const bottomChange = r === size - 1 || regionIdAt(r + 1, c) !== id;

      if (topChange) thick.push("border-t-2", dividerClassName);
      if (leftChange) thick.push("border-l-2", dividerClassName);
      if (rightChange) thick.push("border-r-2", dividerClassName);
      if (bottomChange) thick.push("border-b-2", dividerClassName);
    } else {
      const topThick = r === 0 || r % activeBox.rows === 0;
      const leftThick = c === 0 || c % activeBox.cols === 0;
      const rightThick = c === size - 1 || (c + 1) % activeBox.cols === 0;
      const bottomThick = r === size - 1 || (r + 1) % activeBox.rows === 0;

      if (topThick) thick.push("border-t-2", dividerClassName);
      if (leftThick) thick.push("border-l-2", dividerClassName);
      if (rightThick) thick.push("border-r-2", dividerClassName);
      if (bottomThick) thick.push("border-b-2", dividerClassName);
    }

    if (cellClassName) base.push(cellClassName);
    return cn(base.join(" "), thick.join(" "));
  };

  return (
    <table>
      <tbody className={cn("border-2 border-foreground", className)} {...props}>
        {Array.from({ length: size }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: size }).map((_, c) => (
              <td key={c} className={cellBorderClasses(r, c)}>
                {/* Cell */}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default SudokuGrid;
