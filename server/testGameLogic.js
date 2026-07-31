import { createBoard, makeMove, checkWin } from './gameLogic.js';

function runTests() {
  console.log('🧪 Starting game logic tests...');

  // Test 1: Horizontal Win
  {
    let board = createBoard();
    let move;
    
    // Drop Red in cols 0, 1, 2, 3
    move = makeMove(board, 0, 'red'); board = move.board;
    move = makeMove(board, 1, 'red'); board = move.board;
    move = makeMove(board, 2, 'red'); board = move.board;
    move = makeMove(board, 3, 'red'); board = move.board;

    const isWin = checkWin(board, move.row, 3, 'red');
    if (!isWin) throw new Error('Failed Horizontal Win Test');
    console.log('✅ Horizontal win detection passed.');
  }

  // Test 2: Vertical Win
  {
    let board = createBoard();
    let move;

    // Drop Yellow in col 2 four times
    move = makeMove(board, 2, 'yellow'); board = move.board;
    move = makeMove(board, 2, 'yellow'); board = move.board;
    move = makeMove(board, 2, 'yellow'); board = move.board;
    move = makeMove(board, 2, 'yellow'); board = move.board;

    const isWin = checkWin(board, move.row, 2, 'yellow');
    if (!isWin) throw new Error('Failed Vertical Win Test');
    console.log('✅ Vertical win detection passed.');
  }

  // Test 3: Diagonal Win (bottom-left to top-right)
  {
    let board = createBoard();
    let move;

    // Build steps to form a diagonal win
    // Col 0: [R]
    // Col 1: [Y, R]
    // Col 2: [Y, Y, R]
    // Col 3: [Y, R, Y, R]
    move = makeMove(board, 0, 'red'); board = move.board; // (5, 0)
    
    move = makeMove(board, 1, 'yellow'); board = move.board; // (5, 1)
    move = makeMove(board, 1, 'red'); board = move.board; // (4, 1)
    
    move = makeMove(board, 2, 'yellow'); board = move.board; // (5, 2)
    move = makeMove(board, 2, 'yellow'); board = move.board; // (4, 2)
    move = makeMove(board, 2, 'red'); board = move.board; // (3, 2)
    
    move = makeMove(board, 3, 'yellow'); board = move.board; // (5, 3)
    move = makeMove(board, 3, 'red'); board = move.board; // (4, 3)
    move = makeMove(board, 3, 'yellow'); board = move.board; // (3, 3)
    move = makeMove(board, 3, 'red'); board = move.board; // (2, 3)

    const isWin = checkWin(board, move.row, 3, 'red');
    if (!isWin) throw new Error('Failed Diagonal Win Test');
    console.log('✅ Diagonal win detection passed.');
  }

  console.log('✨ All game logic tests passed successfully!');
}

try {
  runTests();
} catch (error) {
  console.error('❌ Tests failed:', error.message);
  process.exit(1);
}
