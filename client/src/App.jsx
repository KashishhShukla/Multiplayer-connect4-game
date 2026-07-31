import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  Trophy, 
  Send, 
  Users, 
  LogOut, 
  MessageSquare, 
  AlertCircle, 
  RotateCcw, 
  Check, 
  Sparkles, 
  Gamepad2, 
  ShieldAlert 
} from 'lucide-react';

const SOCKET_SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function App() {
  const [socket, setSocket] = useState(null);

  // Navigation & User State
  const [screen, setScreen] = useState("register"); // register, queue, game
  const [username, setUsername] = useState("");
  const [userProfile, setUserProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [registerInput, setRegisterInput] = useState("");

  // Game & Matchmaking States
  const [roomId, setRoomId] = useState("");
  const [playerRed, setPlayerRed] = useState("");
  const [playerYellow, setPlayerYellow] = useState("");
  const [board, setBoard] = useState(
    Array(6)
      .fill(null)
      .map(() => Array(7).fill(null)),
  );
  const [turn, setTurn] = useState("");
  const [gameWinner, setGameWinner] = useState(null);
  const [gameEndedReason, setGameEndedReason] = useState(null);
  const [forfeiter, setForfeiter] = useState(null);
  const [newRatings, setNewRatings] = useState(null);

  // Chat States
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Rematch States
  const [rematchByMe, setRematchByMe] = useState(false);
  const [rematchByOpponent, setRematchByOpponent] = useState(false);

  // Reconnection and Network Alert states
  const [reconnectSeconds, setReconnectSeconds] = useState(null);
  const [opponentOffline, setOpponentOffline] = useState(false);

  const chatBottomRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL, {
      autoConnect: false,
    });

    setSocket(newSocket);
    newSocket.connect();

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Fetch initial leaderboard
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${SOCKET_SERVER_URL}/api/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Reconnection checker
  useEffect(() => {
    if (!socket) return;

    // const savedUsername = localStorage.getItem("connectSyncUsername");
    // if (savedUsername) {
    //   setUsername(savedUsername);
    //   setScreen("register");

    //   // Auto-reconnect handshake
    //   socket.emit("reconnect_game", { username: savedUsername });
    // }

    // Socket Event Receivers
    socket.on("queue_status", ({ inQueue }) => {
      if (inQueue) {
        setScreen("queue");
      }
    });

    socket.on(
      "match_found",
      ({ roomId, playerRed, playerYellow, turn, board }) => {
        console.log("MATCH FOUND");
        console.log("username =", username);
        console.log(
          "localStorage =",
          localStorage.getItem("connectSyncUsername"),
        );


        setRoomId(roomId);
        setPlayerRed(playerRed);
        setPlayerYellow(playerYellow);
        setBoard(board);
        setTurn(turn);
        setGameWinner(null);
        setGameEndedReason(null);
        setForfeiter(null);
        setNewRatings(null);
        setMessages([]);
        setRematchByMe(false);
        setRematchByOpponent(false);
        setOpponentOffline(false);
        setScreen("game");
      },
    );

    socket.on("state_update", ({ board, turn }) => {
      console.log("STATE UPDATE RECEIVED");
      console.log(board);
      console.log(JSON.stringify(board, null, 2));
      console.log(turn);

      setBoard(board);
      setTurn(turn);
    });

    socket.on("receive_message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on(
      "player_disconnected",
      ({ username: disconnectedUser, graceSeconds }) => {
        setOpponentOffline(true);
        setMessages((prev) => [
          ...prev,
          {
            system: true,
            text: `⚠️ ${disconnectedUser} disconnected! Waiting ${graceSeconds}s for reconnection...`,
          },
        ]);
      },
    );

    socket.on("game_resumed", ({ room, message }) => {
      setOpponentOffline(false);
      setBoard(room.board);
      setTurn(room.turn);
      setMessages((prev) => [...prev, { system: true, text: message }]);
    });

    socket.on(
      "game_ended",
      ({
        board: finalBoard,
        winner,
        reason,
        forfeiter: whoForfeited,
        newEloRed,
        newEloYellow,
      }) => {
        setBoard(finalBoard);
        setGameWinner(winner);
        setGameEndedReason(reason);
        setForfeiter(whoForfeited);
        setNewRatings({ red: newEloRed, yellow: newEloYellow });
        fetchLeaderboard(); // refresh stats
      },
    );

    socket.on("rematch_requested", ({ requestedBy }) => {
      if (requestedBy !== username) {
        setRematchByOpponent(true);
      }
    });

    socket.on("game_restarted", ({ board: cleanBoard, turn: newTurn }) => {
      setBoard(cleanBoard);
      setTurn(newTurn);
      setGameWinner(null);
      setGameEndedReason(null);
      setForfeiter(null);
      setNewRatings(null);
      setRematchByMe(false);
      setRematchByOpponent(false);
      setMessages((prev) => [
        ...prev,
        { system: true, text: "🎮 Rematch started!" },
      ]);
    });

    // socket.on("reconnect_failed", () => {
    //   console.log("RECONNECT FAILED");

    //   localStorage.removeItem("connectSyncUsername");
    //   setUsername("");
    // });

    socket.on("error_message", ({ message }) => {
      alert(message);
    });

    return () => {
      socket.off("queue_status");
      socket.off("match_found");
      socket.off("state_update");
      socket.off("receive_message");
      socket.off("player_disconnected");
      socket.off("game_resumed");
      socket.off("game_ended");
      socket.off("rematch_requested");
      socket.off("game_restarted");
      socket.off("reconnect_failed");
      socket.off("error_message");
    };
  }, [socket, username]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  // Handle Form Registration
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!registerInput || registerInput.trim().length < 3) {
      return setErrorMessage("Username must be at least 3 characters.");
    }

    setErrorMessage("");

    try {
      const res = await fetch(`${SOCKET_SERVER_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: registerInput.trim() }),
      });

      if (res.ok) {
        const profile = await res.json();

        setUserProfile(profile);
        setUsername(profile.username);
        console.log("REGISTER ->", profile.username);

        localStorage.setItem("connectSyncUsername", profile.username);

        socket.emit("join_queue", {
          username: profile.username,
        });

        setScreen("queue");
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Registration failed.");
      }
    } catch (err) {
      setErrorMessage("Could not connect to backend server.");
    }
  };

  // Leave Matchmaking Queue
  const leaveQueue = () => {
    if (socket) {
      socket.emit("disconnect");
      // Re-establish socket
      socket.connect();
    }
    localStorage.removeItem("connectSyncUsername");
    setUsername("");
    setUserProfile(null);
    setScreen("register");
  };

  // Handle Game Cell Click
  const handleCellClick = (colIndex) => {
    console.log("CELL CLICKED:", colIndex);
    console.log("Turn:", turn);
    console.log("Username:", username);
    console.log("Socket connected:", socket?.connected);

    if (gameWinner || gameEndedReason) {
      console.log("Game already ended");
      return;
    }

    if (turn !== username) {
      console.log("Not your turn");
      return;
    }

    if (opponentOffline) {
      console.log("Opponent is offline");
      return;
    }

    console.log("Sending make_move");

    socket.emit("make_move", { col: colIndex });
  };
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!chatInput.trim()) return;

    socket.emit("send_message", {
      text: chatInput,
    });

    setChatInput("");
  };
  // Handle Match Forfeiting
  const handleForfeit = () => {
    if (
      window.confirm(
        "Are you sure you want to forfeit this match? You will lose ELO.",
      )
    ) {
      socket.emit("forfeit_game");
    }
  };

  // Request Rematch
  const handleRequestRematch = () => {
    setRematchByMe(true);
    socket.emit("request_rematch");
  };

  // Exit back to lobby/leaderboard
  const handleExitToLobby = () => {
    localStorage.removeItem("connectSyncUsername");
    setUsername("");
    setUserProfile(null);
    setScreen("register");
    fetchLeaderboard();
  };

  // Check color configurations
  const isRedPlayer = username === playerRed;
  const myColor = isRedPlayer ? "red" : "yellow";
  const opponentName = isRedPlayer ? playerYellow : playerRed;
  const isMyTurn = turn === username;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="logo-container">
        <h1 className="logo-title">
          <Gamepad2 size={36} color="#3b82f6" />
          Connect Sync
        </h1>
        <p className="logo-subtitle">
          Real-time online multiplayer Connect Four
        </p>
      </header>

      {/* Screen 1: Register / Welcome */}
      {screen === "register" && (
        <div className="lobby-grid">
          {/* Welcome Screen Card */}
          <div className="glass-card">
            <h2 style={{ fontSize: "1.5rem", marginBottom: "1.25rem" }}>
              Welcome Player
            </h2>
            <form
              onSubmit={handleRegister}
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                  }}
                >
                  Choose Your Nickname
                </label>
                <input
                  type="text"
                  placeholder="e.g. MasterGamer"
                  value={registerInput}
                  onChange={(e) => setRegisterInput(e.target.value)}
                  className="glass-input"
                  maxLength={15}
                />
              </div>

              {errorMessage && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    color: "var(--color-red)",
                    fontSize: "0.85rem",
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button type="submit" className="glass-btn">
                <Sparkles size={18} />
                Find Match
              </button>
            </form>
          </div>

          {/* Leaderboard Card */}
          <div className="glass-card">
            <h2 className="leaderboard-title">
              <Trophy size={20} color="#eab308" />
              Leaderboard
            </h2>
            <div className="leaderboard-list">
              {leaderboard.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "var(--text-muted)",
                    padding: "20px 0",
                  }}
                >
                  No players registered yet.
                </p>
              ) : (
                leaderboard.map((player, idx) => (
                  <div key={player.username} className="leaderboard-row">
                    <span className="leaderboard-rank">{idx + 1}</span>
                    <div className="leaderboard-name">
                      <div>{player.username}</div>
                      <div className="leaderboard-stats">
                        W: {player.wins} | L: {player.losses} | D:{" "}
                        {player.draws}
                      </div>
                    </div>
                    <span className="leaderboard-elo">{player.elo} ELO</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Screen 2: Queue / Searching */}
      {screen === "queue" && (
        <div className="glass-card queue-box">
          <div className="spinner"></div>
          <div>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "8px" }}>
              Searching for Opponent
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Finding a player close to your rank...
            </p>
          </div>
          <button
            onClick={leaveQueue}
            className="glass-btn glass-btn-secondary"
          >
            Cancel Search
          </button>
        </div>
      )}

      {/* Screen 3: Game Board Screen */}
      {screen === "game" && (
        <div className="game-grid">
          {/* Main Board Block */}
          <div className="glass-card">
            <div className="game-status-header">
              <div>
                <span
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Opponent
                </span>
                <h3 style={{ fontSize: "1.25rem" }}>{opponentName}</h3>
              </div>

              {/* Turn Banner */}
              <div>
                {gameWinner || gameEndedReason ? (
                  <span className="status-badge badge-active">Game Over</span>
                ) : isMyTurn ? (
                  <span className={`status-badge badge-${myColor}`}>
                    Your Turn
                  </span>
                ) : (
                  <span
                    className="status-badge"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    Opponent's Turn
                  </span>
                )}
              </div>
            </div>

            {/* Offline Alert */}
            {opponentOffline && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  color: "var(--color-red)",
                  fontSize: "0.85rem",
                }}
              >
                <ShieldAlert size={18} />
                <span>
                  Opponent has disconnected. Waiting for them to reconnect...
                </span>
              </div>
            )}

            {/* Connect 4 Board Component */}
            <div className="board-container">
              {/* Column Indicators Row */}
              <div className="col-selector-row">
                {Array(7)
                  .fill(null)
                  .map((_, colIdx) => (
                    <button
                      key={colIdx}
                      onClick={() => handleCellClick(colIdx)}
                      disabled={
                        !isMyTurn || gameWinner !== null || opponentOffline
                      }
                      className={`col-indicator-btn turn-${myColor}`}
                    >
                      <div className="indicator-dot"></div>
                    </button>
                  ))}
              </div>

              {/* The Blue Game Grid */}
              <div className="connect4-board">
                {board.map((row, rowIdx) => (
                  <div key={rowIdx} className="board-row">
                    {row.map((cell, colIdx) => (
                      <div
                        key={colIdx}
                        className="board-cell"
                        onClick={() => handleCellClick(colIdx)}
                      >
                        <div className="cell-hole"></div>
                        {cell && (
                          <div
                            className={`game-piece piece-${cell} drop-row-${rowIdx}`}
                          ></div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* In-game Forfeit Control */}
            <div
              style={{
                marginTop: "24px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <button
                onClick={handleForfeit}
                className="glass-btn glass-btn-secondary"
                disabled={gameWinner !== null || gameEndedReason !== null}
              >
                Forfeit Match
              </button>
              <div
                style={{ display: "flex", gap: "8px", alignItems: "center" }}
              >
                <span className="badge-active status-badge">
                  <span
                    className={`piece-${myColor}`}
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      display: "inline-block",
                      marginRight: "6px",
                    }}
                  ></span>
                  You: {username}
                </span>
              </div>
            </div>
          </div>

          {/* Right Chat Column */}
          <div className="glass-card chat-container">
            <h3 className="chat-header">
              <MessageSquare size={18} color="var(--accent-blue)" />
              Match Chat
            </h3>

            <div className="chat-messages">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`chat-bubble ${msg.system ? "system" : msg.sender === username ? "self" : "opponent"}`}
                >
                  {!msg.system && (
                    <div
                      className={`chat-sender ${msg.sender === username ? "self" : "opponent"}`}
                    >
                      {msg.sender === username ? "You" : msg.sender}
                    </div>
                  )}
                  <div style={{ wordBreak: "break-word" }}>{msg.text}</div>
                  {!msg.system && (
                    <div className="chat-time">{msg.timestamp}</div>
                  )}
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-form">
              <input
                type="text"
                placeholder="Type a message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="glass-input"
                maxLength={80}
              />
              <button
                type="submit"
                className="glass-btn"
                style={{ padding: "12px" }}
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Game Over Modal overlay */}
      {(gameWinner !== null || gameEndedReason !== null) && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2
              className={`modal-title ${gameWinner === username ? "win" : ""}`}
            >
              {gameWinner === username
                ? "🎉 You Won!"
                : gameWinner === null
                  ? "🤝 Draw Game"
                  : "💀 Defeat"}
            </h2>

            <p style={{ color: "var(--text-secondary)" }}>
              {gameEndedReason === "forfeit" && (
                <span>
                  {forfeiter === username
                    ? "You surrendered the match."
                    : `${opponentName} forfeited the match.`}
                </span>
              )}
              {gameEndedReason === "timeout" && (
                <span>
                  {forfeiter === username
                    ? "You ran out of time."
                    : `${opponentName} failed to reconnect.`}
                </span>
              )}
              {gameEndedReason === "win" && (
                <span>
                  {gameWinner === username
                    ? "Nice play! You got 4 in a row."
                    : "Your opponent got 4 in a row."}
                </span>
              )}
              {gameEndedReason === "draw" && (
                <span>The board is full. Excellent match!</span>
              )}
            </p>

            {newRatings && (
              <div className="elo-change-box">
                <div className="elo-node">
                  <div className="elo-label">{playerRed}</div>
                  <div className="elo-value">{newRatings.red} ELO</div>
                </div>
                <div
                  style={{ color: "var(--text-muted)", fontSize: "1.25rem" }}
                >
                  vs
                </div>
                <div className="elo-node">
                  <div className="elo-label">{playerYellow}</div>
                  <div className="elo-value">{newRatings.yellow} ELO</div>
                </div>
              </div>
            )}

            {/* Rematch options */}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {!rematchByMe ? (
                <button onClick={handleRequestRematch} className="glass-btn">
                  <RotateCcw size={18} />
                  Request Rematch
                </button>
              ) : (
                <div
                  className="status-badge badge-active"
                  style={{ justifyContent: "center", padding: "12px" }}
                >
                  Waiting for Opponent's Acceptance...
                </div>
              )}

              {rematchByOpponent && !rematchByMe && (
                <p
                  style={{ fontSize: "0.85rem", color: "var(--color-yellow)" }}
                >
                  ⚠️ Opponent requested a rematch! Click above to accept.
                </p>
              )}

              <button
                onClick={handleExitToLobby}
                className="glass-btn glass-btn-secondary"
              >
                <LogOut size={18} />
                Exit to Lobby
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
