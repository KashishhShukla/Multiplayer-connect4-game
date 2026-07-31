import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5000';

async function runRealtimeSimulation() {
  console.log('🎮 Starting Real-time Socket Simulation...');

  const socketA = io(SERVER_URL);
  const socketB = io(SERVER_URL);

  let roomId = null;
  let activeTurn = null;

  // Set up promise resolver for matchmaking
  let matchPromiseResolve;
  const matchPromise = new Promise((resolve) => {
    matchPromiseResolve = resolve;
  });

  // Set up promise resolver for chat message
  let chatPromiseResolve;
  const chatPromise = new Promise((resolve) => {
    chatPromiseResolve = resolve;
  });

  // Set up promise resolver for game end
  let gameEndPromiseResolve;
  const gameEndPromise = new Promise((resolve) => {
    gameEndPromiseResolve = resolve;
  });

  // Socket A Events
  socketA.on('connect', () => {
    console.log('🔌 Socket A connected');
    socketA.emit('join_queue', { username: 'Alice' });
  });

  socketA.on('match_found', (data) => {
    console.log(`🤝 Match Found! Room ID: ${data.roomId}`);
    console.log(`   Red: ${data.playerRed} | Yellow: ${data.playerYellow}`);
    roomId = data.roomId;
    activeTurn = data.turn;
    matchPromiseResolve();
  });

  socketA.on('state_update', (data) => {
    activeTurn = data.turn;
    console.log(`🔄 Board updated. Next turn: ${activeTurn}`);
  });

  // Socket B Events
  socketB.on('connect', () => {
    console.log('🔌 Socket B connected');
    socketB.emit('join_queue', { username: 'Bob' });
  });

  socketB.on('receive_message', (data) => {
    console.log(`💬 Chat Received - ${data.sender}: ${data.text}`);
    if (data.sender === 'Alice' && data.text === 'Good luck, Bob!') {
      chatPromiseResolve();
    }
  });

  socketB.on('game_ended', (data) => {
    console.log(`🏆 Game Ended! Winner: ${data.winner || 'Draw'} | Reason: ${data.reason}`);
    console.log(`   Alice New ELO: ${data.newEloRed} | Bob New ELO: ${data.newEloYellow}`);
    gameEndPromiseResolve();
  });

  // Wait for match creation
  await matchPromise;

  // Send a chat message from Alice
  console.log('✉️ Alice sending a chat message...');
  socketA.emit('send_message', { text: 'Good luck, Bob!' });
  await chatPromise;

  // Perform a move
  console.log(`🎲 Active turn is: ${activeTurn}`);
  if (activeTurn === 'Alice') {
    console.log('👉 Alice making a move in column 3...');
    socketA.emit('make_move', { col: 3 });
  } else {
    console.log('👉 Bob making a move in column 3...');
    socketB.emit('make_move', { col: 3 });
  }

  // Allow time for move state update message to log
  await new Promise(resolve => setTimeout(resolve, 500));

  // Trigger a forfeit to conclude the test and verify ELO updates
  console.log('🏳️ Alice forfeits the game...');
  socketA.emit('forfeit_game');
  await gameEndPromise;

  // Cleanup connections
  socketA.disconnect();
  socketB.disconnect();
  console.log('🏁 Real-time Socket Simulation complete!');
  process.exit(0);
}

runRealtimeSimulation().catch(err => {
  console.error('❌ Simulation failed:', err);
  process.exit(1);
});
