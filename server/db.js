import pg from 'pg';

const { Pool } = pg;

let pool = null;

// In-memory safety fallback for offline testing if no PostgreSQL database is reachable
let memoryFallback = {
  active: false,
  users: {},
  matches: []
};

/**
 * Initializes the PostgreSQL Database connection and creates schemas.
 */
export async function initDb() {
  const connectionString = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    'postgresql://postgres:postgres@localhost:5432/connect4';

  const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

  try {
    console.log('[DB] 🔌 Connecting to PostgreSQL...');

    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 20, // Connection pool limit
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Test connection
    const client = await pool.connect();
    console.log('[DB] ✅ PostgreSQL connection established successfully.');
    client.release();

    // 1. Users Table Schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        elo INTEGER NOT NULL DEFAULT 1000,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        games_played INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_users_elo ON users(elo DESC);
      CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
    `);

    // 2. Matches Table Schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id VARCHAR(128) PRIMARY KEY,
        player_red VARCHAR(64) NOT NULL,
        player_yellow VARCHAR(64) NOT NULL,
        winner VARCHAR(64),
        outcome VARCHAR(32) NOT NULL,
        elo_red_before INTEGER NOT NULL,
        elo_yellow_before INTEGER NOT NULL,
        new_elo_red INTEGER NOT NULL,
        new_elo_yellow INTEGER NOT NULL,
        moves_count INTEGER DEFAULT 0,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_matches_timestamp ON matches(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(player_red, player_yellow);
    `);

    console.log('[DB] ✅ PostgreSQL tables and indexes verified.');
    memoryFallback.active = false;
  } catch (error) {
    console.warn(`[DB] ⚠️ Could not connect to PostgreSQL instance (${error.message}).`);
    console.warn('[DB] 💡 Set DATABASE_URL in your .env or Render dashboard to connect your live database.');
    console.warn('[DB] Operating in temporary memory mode to prevent server crash.');
    memoryFallback.active = true;
  }
}

/**
 * Gets or creates a user profile in PostgreSQL.
 */
export async function getOrCreateUser(username) {
  const cleanName = username.trim();

  if (!memoryFallback.active && pool) {
    // 1. Check if user exists (case-insensitive)
    const selectRes = await pool.query(
      'SELECT username, elo, wins, losses, draws, games_played AS "gamesPlayed" FROM users WHERE LOWER(username) = LOWER($1)',
      [cleanName]
    );

    if (selectRes.rows.length > 0) {
      return selectRes.rows[0];
    }

    // 2. Insert new user
    const insertRes = await pool.query(
      `INSERT INTO users (username, elo, wins, losses, draws, games_played) 
       VALUES ($1, 1000, 0, 0, 0, 0) 
       RETURNING username, elo, wins, losses, draws, games_played AS "gamesPlayed"`,
      [cleanName]
    );

    return insertRes.rows[0];
  } else {
    // Fallback mode
    const key = cleanName.toLowerCase();
    if (!memoryFallback.users[key]) {
      memoryFallback.users[key] = {
        username: cleanName,
        elo: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0
      };
    }
    return memoryFallback.users[key];
  }
}

/**
 * Gets the leaderboard sorted by ELO rating and wins.
 */
export async function getLeaderboard(limit = 10) {
  if (!memoryFallback.active && pool) {
    const res = await pool.query(
      `SELECT username, elo, wins, losses, draws, games_played AS "gamesPlayed" 
       FROM users 
       ORDER BY elo DESC, wins DESC 
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  return Object.values(memoryFallback.users)
    .sort((a, b) => b.elo - a.elo || b.wins - a.wins)
    .slice(0, limit);
}

/**
 * Updates ELO ratings and stores match result in PostgreSQL.
 * Uses standard competitive ELO rating algorithm (K=32).
 */
export async function recordMatchResult(playerA, playerB, outcome, movesCount = 0) {
  const userA = await getOrCreateUser(playerA);
  const userB = await getOrCreateUser(playerB);

  const ratingA = userA.elo;
  const ratingB = userB.elo;

  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  const K = 32;
  let scoreA, scoreB;
  let winner = null;

  if (outcome === 'draw') {
    scoreA = 0.5;
    scoreB = 0.5;
    userA.draws++;
    userB.draws++;
  } else if (outcome === playerA) {
    scoreA = 1;
    scoreB = 0;
    winner = playerA;
    userA.wins++;
    userB.losses++;
  } else {
    scoreA = 0;
    scoreB = 1;
    winner = playerB;
    userA.losses++;
    userB.wins++;
  }

  userA.gamesPlayed++;
  userB.gamesPlayed++;

  const newEloA = Math.max(100, Math.round(ratingA + K * (scoreA - expectedA)));
  const newEloB = Math.max(100, Math.round(ratingB + K * (scoreB - expectedB)));

  userA.elo = newEloA;
  userB.elo = newEloB;

  const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const timestamp = new Date().toISOString();

  if (!memoryFallback.active && pool) {
    // Update player A
    await pool.query(
      `UPDATE users 
       SET elo = $1, wins = $2, losses = $3, draws = $4, games_played = $5, updated_at = NOW() 
       WHERE LOWER(username) = LOWER($6)`,
      [newEloA, userA.wins, userA.losses, userA.draws, userA.gamesPlayed, userA.username]
    );

    // Update player B
    await pool.query(
      `UPDATE users 
       SET elo = $1, wins = $2, losses = $3, draws = $4, games_played = $5, updated_at = NOW() 
       WHERE LOWER(username) = LOWER($6)`,
      [newEloB, userB.wins, userB.losses, userB.draws, userB.gamesPlayed, userB.username]
    );

    // Insert match history record
    await pool.query(
      `INSERT INTO matches (
        id, player_red, player_yellow, winner, outcome, 
        elo_red_before, elo_yellow_before, new_elo_red, new_elo_yellow, 
        moves_count, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        matchId, playerA, playerB, winner, outcome,
        ratingA, ratingB, newEloA, newEloB,
        movesCount, timestamp
      ]
    );
  } else {
    memoryFallback.users[playerA.toLowerCase()] = userA;
    memoryFallback.users[playerB.toLowerCase()] = userB;
    memoryFallback.matches.unshift({
      id: matchId,
      playerRed: playerA,
      playerYellow: playerB,
      winner,
      outcome,
      eloRedBefore: ratingA,
      eloYellowBefore: ratingB,
      newEloRed: newEloA,
      newEloYellow: newEloB,
      movesCount,
      timestamp
    });
  }

  return { newEloA, newEloB, matchId };
}

/**
 * Gets the most recent matches list.
 */
export async function getRecentMatches(limit = 10) {
  if (!memoryFallback.active && pool) {
    const res = await pool.query(
      `SELECT id, player_red AS "playerRed", player_yellow AS "playerYellow", 
              winner, outcome, elo_red_before AS "eloRedBefore", 
              elo_yellow_before AS "eloYellowBefore", new_elo_red AS "newEloRed", 
              new_elo_yellow AS "newEloYellow", moves_count AS "movesCount", 
              timestamp 
       FROM matches 
       ORDER BY timestamp DESC 
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  }

  return memoryFallback.matches.slice(0, limit);
}

/**
 * Gets user profile and past 10 matches.
 */
export async function getUserProfile(username) {
  const cleanName = username.trim();
  const user = await getOrCreateUser(cleanName);

  let recentMatches = [];

  if (!memoryFallback.active && pool) {
    const res = await pool.query(
      `SELECT id, player_red AS "playerRed", player_yellow AS "playerYellow", 
              winner, outcome, elo_red_before AS "eloRedBefore", 
              elo_yellow_before AS "eloYellowBefore", new_elo_red AS "newEloRed", 
              new_elo_yellow AS "newEloYellow", moves_count AS "movesCount", 
              timestamp 
       FROM matches 
       WHERE LOWER(player_red) = LOWER($1) OR LOWER(player_yellow) = LOWER($1) 
       ORDER BY timestamp DESC 
       LIMIT 10`,
      [cleanName]
    );
    recentMatches = res.rows;
  } else {
    const key = cleanName.toLowerCase();
    recentMatches = memoryFallback.matches
      .filter(m => m.playerRed.toLowerCase() === key || m.playerYellow.toLowerCase() === key)
      .slice(0, 10);
  }

  return {
    ...user,
    recentMatches
  };
}

/**
 * Returns PostgreSQL engine diagnostics.
 */
export async function getDbStatus() {
  let userCount = 0;
  let matchCount = 0;
  let isConnected = false;

  if (!memoryFallback.active && pool) {
    try {
      const uRes = await pool.query('SELECT COUNT(*) as count FROM users');
      const mRes = await pool.query('SELECT COUNT(*) as count FROM matches');
      userCount = parseInt(uRes.rows[0].count, 10);
      matchCount = parseInt(mRes.rows[0].count, 10);
      isConnected = true;
    } catch {}
  } else {
    userCount = Object.keys(memoryFallback.users).length;
    matchCount = memoryFallback.matches.length;
  }

  return {
    engine: isConnected ? 'PostgreSQL (Cloud Database)' : 'PostgreSQL (Connecting...)',
    dbType: 'postgres',
    connected: isConnected,
    userCount,
    matchCount
  };
}
