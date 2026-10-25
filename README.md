# Connect Sync 🎮

Connect Sync is a high-performance, real-time multiplayer Connect Four platform featuring competitive matchmaking queues, live in-game chatting, database persistence, and a reconnection-tolerant game loop.

# Live Project
- 🎮 **Frontend:** [Connect Sync](https://multiplayer-connect4-game.vercel.app)
- ⚙️ **Backend API:** [Render Server](https://multiplayer-connect4-game.onrender.com)

---

## Technical Highlights

*   **Real-Time Matchmaking**: Automatically matches active players in a dynamic game lobby based on current availability.
*   **Dynamic ELO Rankings**: Implements the standard competitive chess rating algorithm to update player ranks dynamically on the live database leaderboard.
*   **Reconnection Grace Period**: Protects game sessions from transient network loss by pausing active matches for 15 seconds, allowing players to reconnect without forfeiting their ratings.
*   **Integrated Live Chat**: Synchronizes messages instantly between opponents.

---

## Tech Stack

*   **Frontend**: React, Vanilla CSS (Glassmorphic design system), Socket.io Client.
*   **Backend**: Node.js, Express, Socket.io Server.
*   **Database & Storage**: **PostgreSQL** (Managed Cloud Database via `DATABASE_URL` with connection pooling, transactional ELO calculation, and match histories).
*   **Caching & Sessions**: In-memory Redis-style session and room store (`server/store.js`).

---

## Database Architecture (PostgreSQL)

The platform uses **PostgreSQL** with connection pooling (`pg.Pool`) to provide persistent, ACID-compliant storage for competitive rankings and match histories.

### Why PostgreSQL?
- **Stateless Cloud Backend**: Platforms like Render, Railway, and Fly.io have ephemeral filesystems on their free tiers (local files are wiped on redeployment or server sleep). Connecting to a managed cloud PostgreSQL database (via Neon.tech, Supabase, or Render PostgreSQL) ensures all records, ELO ratings, and statistics are stored permanently.
- **Horizontal Scalability & High Concurrency**: Multi-Version Concurrency Control (MVCC) enables high-speed concurrent player writes and matchmaking updates without file locks.

### Tables & Schema
- **`users` Table**:
  - `id`: Unique integer auto-increment primary key
  - `username`: Unique player handle (case-insensitive)
  - `elo`: Competitive Elo rating (starts at 1000)
  - `wins`, `losses`, `draws`, `games_played`: Cumulative match statistics
  - `created_at`, `updated_at`: Timestamps
  - *Indexes*: `idx_users_elo` (DESC), `idx_users_username`

- **`matches` Table**:
  - `id`: Unique match UUID
  - `player_red`, `player_yellow`: Foreign-key references to players
  - `winner`: Username of the winner or NULL for draws
  - `outcome`: Match conclusion type (`win`, `draw`, `forfeit`, `timeout`)
  - `elo_red_before`, `elo_yellow_before`: Ratings prior to match
  - `new_elo_red`, `new_elo_yellow`: New calculated Elo ratings post-match
  - `moves_count`: Total moves played in the match
  - `timestamp`: Match completion timestamp
  - *Indexes*: `idx_matches_timestamp` (DESC), `idx_matches_players`

### Database API Endpoints
- `GET /api/leaderboard`: Returns top players ordered by Elo and wins.
- `GET /api/matches`: Returns recent match history.
- `GET /api/user/:username`: Returns specific player stats and their past 10 matches.
- `GET /api/db-status`: Returns database engine diagnostics and total stored records.
- `POST /api/register`: Registers/logs in a player profile.

---

## Project Structure

```text
├── client/                     # Frontend React client
│   ├── src/
│   │   ├── App.jsx             # User states, sockets, leaderboard & match history tabs
│   │   └── index.css           # UI design tokens and token drop animations
│   └── package.json
│
└── server/                     # Backend Node.js server
    ├── index.js                # WebSocket handlers & API routing
    ├── store.js                # Matchmaking queue cache layer
    ├── db.js                   # PostgreSQL operations, schema migrations & Elo algorithms
    ├── gameLogic.js            # Connect Four grid win condition checker
    ├── .env.example            # Sample configuration with DATABASE_URL
    └── package.json
```

---

## Local Setup

Ensure you have [Node.js](https://nodejs.org/) installed, then run:

```bash
# Install dependencies for both client and server
npm run install:all

# Start both servers concurrently
npm run dev
```
*   **Frontend client**: http://localhost:3000
*   **Backend API**: http://localhost:5000
