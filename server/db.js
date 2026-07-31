import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');

const INITIAL_DB = {
  users: {},      // username -> { username, elo, wins, losses, draws, gamesPlayed }
  matches: []     // list of finished match objects
};

/**
 * Initializes the file-based database if it doesn't exist.
 */
export async function initDb() {
  try {
    await fs.access(DB_FILE);
  } catch {
    // File doesn't exist, create it
    await saveDb(INITIAL_DB);
  }
}

/**
 * Reads database contents.
 */
async function readDb() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file, resetting database:', error);
    return INITIAL_DB;
  }
}

/**
 * Writes database contents.
 */
async function saveDb(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Gets or creates a user profile in the database.
 */
export async function getOrCreateUser(username) {
  const db = await readDb();
  const normalized = username.trim().toLowerCase();
  
  if (!db.users[normalized]) {
    db.users[normalized] = {
      username: username.trim(),
      elo: 1000,
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0
    };
    await saveDb(db);
  }
  return db.users[normalized];
}

/**
 * Gets the current leaderboard (top users by ELO rating).
 */
export async function getLeaderboard(limit = 10) {
  const db = await readDb();
  return Object.values(db.users)
    .sort((a, b) => b.elo - a.elo)
    .slice(0, limit);
}

/**
 * Updates ELO ratings and match history after a game concludes.
 */
export async function recordMatchResult(playerA, playerB, outcome) {
  const db = await readDb();
  
  const userA = db.users[playerA.toLowerCase()] || {
    username: playerA, elo: 1000, wins: 0, losses: 0, draws: 0, gamesPlayed: 0
  };
  const userB = db.users[playerB.toLowerCase()] || {
    username: playerB, elo: 1000, wins: 0, losses: 0, draws: 0, gamesPlayed: 0
  };

  const ratingA = userA.elo;
  const ratingB = userB.elo;

  // Calculate ELO expectations
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  const K = 32; // ELO weight factor
  let scoreA, scoreB;

  if (outcome === 'draw') {
    scoreA = 0.5;
    scoreB = 0.5;
    userA.draws++;
    userB.draws++;
  } else if (outcome === playerA) {
    scoreA = 1;
    scoreB = 0;
    userA.wins++;
    userB.losses++;
  } else {
    scoreA = 0;
    scoreB = 1;
    userA.losses++;
    userB.wins++;
  }

  userA.gamesPlayed++;
  userB.gamesPlayed++;

  // New ratings
  const newEloA = Math.round(ratingA + K * (scoreA - expectedA));
  const newEloB = Math.round(ratingB + K * (scoreB - expectedB));

  userA.elo = newEloA;
  userB.elo = newEloB;

  // Save back to db memory
  db.users[playerA.toLowerCase()] = userA;
  db.users[playerB.toLowerCase()] = userB;

  // Record match history
  const matchRecord = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    playerA,
    playerB,
    eloA: ratingA,
    eloB: ratingB,
    newEloA,
    newEloB,
    outcome,
    timestamp: new Date().toISOString()
  };
  db.matches.push(matchRecord);

  await saveDb(db);
  return { newEloA, newEloB };
}
