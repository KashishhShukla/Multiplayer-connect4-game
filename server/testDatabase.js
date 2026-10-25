import { 
  initDb, 
  getOrCreateUser, 
  getLeaderboard, 
  recordMatchResult, 
  getRecentMatches, 
  getUserProfile, 
  getDbStatus 
} from './db.js';

async function runDatabaseTests() {
  console.log('🧪 Starting Database Layer Test Suite...');

  // 1. Initialize Database
  console.log('1️⃣ Initializing PostgreSQL DB...');
  await initDb();

  // 2. Register / Get Users
  console.log('2️⃣ Registering test players...');
  const player1 = await getOrCreateUser('GrandmasterFlash');
  const player2 = await getOrCreateUser('Connect4Pro');

  console.log('   Player 1:', player1);
  console.log('   Player 2:', player2);

  if (player1.elo !== 1000 || player2.elo !== 1000) {
    throw new Error('Default ELO rating should be 1000');
  }

  // 3. Record a simulated match
  console.log('3️⃣ Recording match result (GrandmasterFlash wins)...');
  const matchResult = await recordMatchResult(
    'GrandmasterFlash', 
    'Connect4Pro', 
    'GrandmasterFlash',
    18 // 18 moves played
  );
  console.log('   Match Result ELO changes:', matchResult);

  if (matchResult.newEloA <= 1000 || matchResult.newEloB >= 1000) {
    throw new Error('Winner ELO should increase and Loser ELO should decrease');
  }

  // 4. Query Leaderboard
  console.log('4️⃣ Querying Leaderboard...');
  const leaderboard = await getLeaderboard(5);
  console.log('   Top Leaderboard:', leaderboard);

  if (leaderboard[0].username !== 'GrandmasterFlash') {
    throw new Error('Leaderboard should rank GrandmasterFlash at #1');
  }

  // 5. Query Recent Matches
  console.log('5️⃣ Querying Recent Matches...');
  const recentMatches = await getRecentMatches(5);
  console.log('   Recent Matches:', recentMatches);

  if (recentMatches.length === 0) {
    throw new Error('Recent matches should contain the newly recorded game');
  }

  // 6. Query User Profile
  console.log('6️⃣ Querying User Profile for GrandmasterFlash...');
  const profile = await getUserProfile('GrandmasterFlash');
  console.log(`   Profile for ${profile.username}: Wins=${profile.wins}, ELO=${profile.elo}, Matches Count=${profile.recentMatches.length}`);

  // 7. Check Database Diagnostics
  console.log('7️⃣ Checking DB Diagnostics...');
  const status = await getDbStatus();
  console.log('   DB Status:', status);

  console.log('✨ All Database Layer tests executed successfully!');
}

runDatabaseTests().catch(err => {
  console.error('❌ Database Test Error:', err);
  process.exit(1);
});
