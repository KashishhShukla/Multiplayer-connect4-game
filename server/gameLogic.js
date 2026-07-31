// Connect Four Game Logic
export const COLS = 7;
export const ROWS = 6;

/**
 * Creates an empty 6x7 grid (represented as a 2D array of nulls)
 */
export function createBoard() {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
}

/**
 * Attempts to drop a piece into a column.
 * Returns the updated board and the row index where the piece landed,
 * or null if the column is full.
 */
export function makeMove(board, col, player) {
  if (col < 0 || col >= COLS) return null;

  // Start from the bottom row and go up to find the first empty spot
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) {
      const newBoard = board.map(row => [...row]); // Deep copy outer array
      newBoard[r][col] = player;
      return { board: newBoard, row: r };
    }
  }
  return null; // Column is full
}

/**
 * Checks if the last move resulted in a win.
 */
export function checkWin(board, row, col, player) {
  // Check horizontal
  if (checkDirection(board, row, col, 0, 1, player)) return true;
  // Check vertical
  if (checkDirection(board, row, col, 1, 0, player)) return true;
  // Check diagonal top-left to bottom-right (\)
  if (checkDirection(board, row, col, 1, 1, player)) return true;
  // Check diagonal bottom-left to top-right (/)
  if (checkDirection(board, row, col, 1, -1, player)) return true;

  return false;
}

/**
 * Checks a direction (defined by rowDir and colDir) for 4 in a row of the player's piece.
 */
function checkDirection(board, row, col, rowDir, colDir, player) {
  let count = 1;

  // Search forward direction
  let r = row + rowDir;
  let c = col + colDir;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r += rowDir;
    c += colDir;
  }

  // Search backward direction
  r = row - rowDir;
  c = col - colDir;
  while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === player) {
    count++;
    r -= rowDir;
    c -= colDir;
  }

  return count >= 4;
}

/**
 * Checks if the board is completely full.
 */
export function checkDraw(board) {
  return board[0].every(cell => cell !== null);
}
