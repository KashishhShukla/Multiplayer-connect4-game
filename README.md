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
*   **Database & Caching**: PostgreSQL (Match history & Elo storage), Redis (Session storage & matchmaking queue).

---

## Project Structure

```text
├── client/                     # Frontend React client
│   ├── src/
│   │   ├── App.jsx             # User states, sockets, and game layout
│   │   └── index.css           # UI design tokens and token drop animations
│   └── package.json
│
└── server/                     # Backend Node.js server
    ├── index.js                # WebSocket handlers & API routing
    ├── store.js                # Matchmaking queue cache layer
    ├── db.js                   # Database operations & Elo algorithms
    ├── gameLogic.js            # Connect Four grid win condition checker
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
