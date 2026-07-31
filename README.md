# Connect Sync 🎮

Connect Sync is a high-performance, real-time multiplayer Connect Four platform featuring competitive matchmaking queues, live in-game chatting, database persistence, and a reconnection-tolerant game loop.

## Key Features

*   **Real-Time Matchmaking Queue**: Connects players of similar skill levels automatically.
*   **Dynamic ELO Rankings**: Implements the standard chess rating system formula to scale player rank after each match.
*   **Reconnection Grace Period**: Protects players from sudden network losses; games are paused for 15 seconds, allowing the disconnected user to rejoin without forfeiting.
*   **Integrated Live Chat**: Allows players to text in real-time.
*   **Robust Fallback Architecture**: Connects to Redis and PostgreSQL in production, with seamless fallbacks to local memory cache and SQLite for local development.

---

## Tech Stack

*   **Frontend**: React (Vite), Vanilla CSS (Custom Glassmorphism design system), Socket.io Client.
*   **Backend**: Node.js (Express), Socket.io Server.
*   **Storage & Caching**: Redis (cache) with local memory fallback, PostgreSQL (db) with SQLite fallback.

---

## Directory Structure

```text
├── client/
│   ├── index.html              # Entry HTML loading Outfit & Inter fonts
│   ├── package.json            # React dependencies
│   ├── vite.config.js          # Vite config & dev server settings
│   └── src/
│       ├── main.jsx            # React root mount
│       ├── index.css           # Glassmorphism visual tokens & animations
│       └── App.jsx             # State manager (Lobby, Queue, Game, Chat)
│
└── server/
    ├── package.json            # Node.js dependencies
    ├── index.js                # WebSocket lifecycle & REST API
    ├── store.js                # Session store & matchmaking queue
    ├── db.js                   # JSON-based database & ELO formulas
    └── gameLogic.js            # Connect Four grid physics & win checking
```

---

## Local Development Quickstart

Before starting, ensure you have [Node.js](https://nodejs.org/) installed.

### 1. Install dependencies for all folders
Run this command from the **root directory**:
```bash
npm run install:all
```
This automatically runs `npm install` inside both the `client/` and `server/` subfolders.

### 2. Run both servers concurrently
Launch both development servers with a single command:
```bash
npm run dev
```
*   **Frontend**: Opens at [http://localhost:3000](http://localhost:3000)
*   **Backend API**: Opens at [http://localhost:5000](http://localhost:5000)

---

## Publishing to GitHub

To publish this project to GitHub, initialize a Git repository at the root directory:

```bash
# Initialize and commit
git init
git add .
git commit -m "feat: initial commit for Connect Sync"

# Create a repository on github.com and link it
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

---

## Cloud Deployment Guide (Free Tier)

Follow these steps to host your application live:

### 1. Deploy the Backend (API Server) to Render.com
1. Sign up for a free account at [Render.com](https://render.com/).
2. Create a **New Web Service** and connect your GitHub repository.
3. Configure the following settings:
    *   **Root Directory**: `server`
    *   **Runtime**: `Node`
    *   **Build Command**: `npm install`
    *   **Start Command**: `node index.js`
4. Add the following **Environment Variables**:
    *   `FRONTEND_URL`: `https://<your-vercel-app-url>.vercel.app` (Your frontend URL, allows CORS security).
5. Deploy! Copy the provided server URL (e.g. `https://connect-sync-api.onrender.com`).

### 2. Deploy the Frontend (Client) to Vercel.com
1. Sign up for a free account at [Vercel.com](https://vercel.com/).
2. Click **Add New Project** and import your GitHub repository.
3. Configure the following settings:
    *   **Framework Preset**: `Vite`
    *   **Root Directory**: `client`
4. Add the following **Environment Variable**:
    *   `VITE_BACKEND_URL`: `https://<your-render-app-url>.onrender.com` (Your Render server URL).
5. Deploy! You will be given a live `.vercel.app` URL to share with friends.
