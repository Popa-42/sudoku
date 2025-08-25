import SudokuGrid from "@/components/sudoku/grid";

export default function Home() {
  const regions9: number[][] = [
    [0, 0, 1, 1, 1, 1, 2, 2, 2],
    [0, 0, 0, 0, 1, 2, 2, 2, 2],
    [0, 0, 3, 1, 1, 1, 1, 2, 5],
    [0, 3, 3, 4, 4, 4, 4, 2, 5],
    [3, 3, 3, 4, 4, 5, 5, 5, 5],
    [3, 3, 6, 4, 4, 4, 8, 8, 5],
    [3, 6, 6, 6, 7, 8, 8, 8, 5],
    [6, 6, 6, 7, 7, 7, 8, 8, 5],
    [6, 6, 7, 7, 7, 7, 7, 8, 8],
  ];

  return (
    <div>
      <SudokuGrid size={9} regions={regions9} />
    </div>
  );
}
