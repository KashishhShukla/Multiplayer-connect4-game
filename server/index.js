import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDb, getOrCreateUser, getLeaderboard, recordMatchResult } from './db.js';
import { createBoard, makeMove, checkWin, checkDraw } from './gameLogic.js';
import store from './store.js';

const app = express();
app.use(cors());
app.use(express.json());

const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'] 
  : '*';

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Initialize database
await initDb();

// HTTP REST API Endpoints
app.get('/api/leaderboard', async (req, res) => {
  try {
    const board = await getLeaderboard(10);
    res.json(board);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long.' });
  }
  try {
    const user = await getOrCreateUser(username);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dictionary to track active disconnection timeouts by room ID
const disconnectTimeouts = new Map();

// Socket.io Real-Time Event System
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Join matchmaking queue
  socket.on('join_queue', async ({ username }) => {
    if (!username) return;
    
    const user = await getOrCreateUser(username);
    await store.setPlayerSession(socket.id, { username: user.username, roomId: null });
    
    console.log(`${user.username} joined matchmaking queue`);
    const queue = await store.addToQueue(socket.id, user.username, user.elo);

    // Matchmaking logic: If 2 or more players are in the queue, match them
    if (queue.length >= 2) {
      const player1 = queue[0];
      const player2 = queue[1];

      // Remove both from queue
      await store.removeFromQueue(player1.socketId);
      await store.removeFromQueue(player2.socketId);

      const roomId = `room_${Date.now()}`;
      const firstTurn = Math.random() < 0.5 ? player1.username : player2.username;

      const newRoom = {
        id: roomId,
        playerRed: player1.username,
        playerYellow: player2.username,
        socketRed: player1.socketId,
        socketYellow: player2.socketId,
        board: createBoard(),
        turn: firstTurn,
        status: 'active', // active, finished, paused
        winner: null,
        rematchRequests: [], // usernames of players requesting rematch
        moves: []
      };

      // Store room state
      await store.setRoom(roomId, newRoom);

      // Link socket sessions to the room
      await store.setPlayerSession(player1.socketId, { username: player1.username, roomId });
      await store.setPlayerSession(player2.socketId, { username: player2.username, roomId });

      // Join sockets to socket.io room room
      const s1 = io.sockets.sockets.get(player1.socketId);
      const s2 = io.sockets.sockets.get(player2.socketId);
      if (s1) s1.join(roomId);
      if (s2) s2.join(roomId);

      // Notify clients
      io.to(roomId).emit('match_found', {
        roomId,
        playerRed: player1.username,
        playerYellow: player2.username,
        turn: firstTurn,
        board: newRoom.board
      });
      console.log(`Match started between ${player1.username} and ${player2.username} in ${roomId}`);
    } else {
      // Notify single user they are in queue
      socket.emit('queue_status', { inQueue: true });
    }
  });

  // 2. Reconnect to active game (grace period handler)
  socket.on('reconnect_game', async ({ username }) => {
    if (!username) return;

    // Scan all rooms to see if this user is in an active/paused room
    const memory = store.rooms;
    for (const [roomId, room] of memory.entries()) {
      if ((room.playerRed === username || room.playerYellow === username) && room.status !== 'finished') {
        
        // Cancel the pending disconnect timeout for this room
        if (disconnectTimeouts.has(roomId)) {
          clearTimeout(disconnectTimeouts.get(roomId));
          disconnectTimeouts.delete(roomId);
        }

        // Update the active socket reference
        const isRed = room.playerRed === username;
        if (isRed) {
          room.socketRed = socket.id;
        } else {
          room.socketYellow = socket.id;
        }

        room.status = 'active'; // resume game
        await store.setRoom(roomId, room);
        await store.setPlayerSession(socket.id, { username, roomId });

        socket.join(roomId);
        
        // Notify players that game is resumed
        io.to(roomId).emit('game_resumed', {
          room,
          message: `${username} reconnected. Game resumes!`
        });
        console.log(`${username} successfully reconnected to ${roomId}`);
        return;
      }
    }
    
    // If no room found, tell client to go back to lobby
    socket.emit('reconnect_failed');
  });

  // 3. Process move
  socket.on('make_move', async ({ col }) => {
    console.log("MOVE RECEIVED:", socket.id, col);
    const session = await store.getPlayerSession(socket.id);
    if (!session || !session.roomId) return;

    const room = await store.getRoom(session.roomId);
    if (!room || room.status !== 'active') return;

    const currentPlayer = room.turn;
    const isPlayerTurn = (currentPlayer === session.username);
    
    if (!isPlayerTurn) {
      return socket.emit('error_message', { message: "It's not your turn!" });
    }

    const playerColor = (room.playerRed === session.username) ? 'red' : 'yellow';
    
    // Apply game logic move
    const moveResult = makeMove(room.board, col, playerColor);
    if (!moveResult) {
      return socket.emit('error_message', { message: "Column is full!" });
    }

    room.board = moveResult.board;
    room.moves.push({ player: session.username, col, row: moveResult.row });

    // Check for win
    const isWin = checkWin(room.board, moveResult.row, col, playerColor);
    if (isWin) {
      room.status = 'finished';
      room.winner = session.username;
      await store.setRoom(room.id, room);

      // Record match result in SQL DB
      const result = await recordMatchResult(room.playerRed, room.playerYellow, room.winner);

      io.to(room.id).emit('game_ended', {
        board: room.board,
        winner: room.winner,
        reason: 'win',
        newEloRed: result.newEloA,
        newEloYellow: result.newEloB
      });
      console.log(`Game in ${room.id} won by ${room.winner}`);
      return;
    }

    // Check for draw
    const isDraw = checkDraw(room.board);
    if (isDraw) {
      room.status = 'finished';
      room.winner = null;
      await store.setRoom(room.id, room);

      const result = await recordMatchResult(room.playerRed, room.playerYellow, 'draw');

      io.to(room.id).emit('game_ended', {
        board: room.board,
        winner: null,
        reason: 'draw',
        newEloRed: result.newEloA,
        newEloYellow: result.newEloB
      });
      console.log(`Game in ${room.id} ended in a draw`);
      return;
    }

    // Toggle turn
    room.turn = (room.turn === room.playerRed) ? room.playerYellow : room.playerRed;
    await store.setRoom(room.id, room);

    // Broadcast updated state
    io.to(room.id).emit('state_update', {
      board: room.board,
      turn: room.turn
    });
  });

  // 4. Handle in-game chat
  socket.on('send_message', async ({ text }) => {
    const session = await store.getPlayerSession(socket.id);
    if (!session || !session.roomId || !text) return;

    io.to(session.roomId).emit('receive_message', {
      sender: session.username,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  // 5. Player forfeits
  socket.on('forfeit_game', async () => {
    const session = await store.getPlayerSession(socket.id);
    if (!session || !session.roomId) return;

    const room = await store.getRoom(session.roomId);
    if (!room || room.status === 'finished') return;

    const opponent = (room.playerRed === session.username) ? room.playerYellow : room.playerRed;
    
    room.status = 'finished';
    room.winner = opponent;
    await store.setRoom(room.id, room);

    const result = await recordMatchResult(room.playerRed, room.playerYellow, opponent);

    io.to(room.id).emit('game_ended', {
      board: room.board,
      winner: opponent,
      reason: 'forfeit',
      forfeiter: session.username,
      newEloRed: result.newEloA,
      newEloYellow: result.newEloB
    });
    console.log(`${session.username} forfeited game in ${room.id}`);
  });

  // 6. Rematch handling
  socket.on('request_rematch', async () => {
    const session = await store.getPlayerSession(socket.id);
    if (!session || !session.roomId) return;

    const room = await store.getRoom(session.roomId);
    if (!room || room.status !== 'finished') return;

    if (!room.rematchRequests.includes(session.username)) {
      room.rematchRequests.push(session.username);
      await store.setRoom(room.id, room);
    }

    io.to(room.id).emit('rematch_requested', { requestedBy: session.username });

    // If both players agreed to rematch, reset the board
    if (room.rematchRequests.length === 2) {
      room.board = createBoard();
      room.status = 'active';
      room.winner = null;
      room.rematchRequests = [];
      room.moves = [];
      // Alternate first turn from previous starting turn
      room.turn = Math.random() < 0.5 ? room.playerRed : room.playerYellow;
      await store.setRoom(room.id, room);

      io.to(room.id).emit('game_restarted', {
        board: room.board,
        turn: room.turn
      });
      console.log(`Rematch started in room ${room.id}`);
    }
  });

  // 7. Disconnection
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);
    
    const session = await store.getPlayerSession(socket.id);
    if (session) {
      // Remove from matchmaking queue if they were searching
      await store.removeFromQueue(socket.id);

      if (session.roomId) {
        const room = await store.getRoom(session.roomId);
        if (room && room.status === 'active') {
          // Pause the game
          room.status = 'paused';
          await store.setRoom(session.roomId, room);

          // Alert opponent
          io.to(session.roomId).emit('player_disconnected', {
            username: session.username,
            graceSeconds: 15
          });

          // Set 15-second grace period timer
          const timeoutId = setTimeout(async () => {
            const currentRoom = await store.getRoom(session.roomId);
            if (currentRoom && currentRoom.status === 'paused') {
              // Grace period expired, opponent wins by forfeit
              const opponent = (currentRoom.playerRed === session.username) ? currentRoom.playerYellow : currentRoom.playerRed;
              
              currentRoom.status = 'finished';
              currentRoom.winner = opponent;
              await store.setRoom(session.roomId, currentRoom);

              const result = await recordMatchResult(currentRoom.playerRed, currentRoom.playerYellow, opponent);

              io.to(session.roomId).emit('game_ended', {
                board: currentRoom.board,
                winner: opponent,
                reason: 'timeout',
                forfeiter: session.username,
                newEloRed: result.newEloA,
                newEloYellow: result.newEloB
              });
              console.log(`Game in ${session.roomId} ended due to reconnection timeout for ${session.username}`);
            }
            disconnectTimeouts.delete(session.roomId);
          }, 15000);

          disconnectTimeouts.set(session.roomId, timeoutId);
        }
      }
      
      // Clean up player socket session
      await store.deletePlayerSession(socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Socket Server running on port ${PORT}`);
});
