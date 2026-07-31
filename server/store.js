// Cache & Session Store
// Implements an asynchronous key-value API designed to mock Redis operations

class MemoryStore {
  constructor() {
    this.rooms = new Map();       // roomId -> Room state object
    this.sessions = new Map();    // socketId -> Session object { username, roomId }
    this.queue = [];              // Array of { socketId, username, elo }
  }

  // --- Matchmaking Queue Operations ---

  async addToQueue(socketId, username, elo = 1000) {
    // Remove if already in queue to prevent duplicates
    await this.removeFromQueue(socketId);
    this.queue.push({ socketId, username, elo });
    return this.queue;
  }

  async removeFromQueue(socketId) {
    this.queue = this.queue.filter(player => player.socketId !== socketId);
    return this.queue;
  }

  async getQueue() {
    return [...this.queue];
  }

  // --- Game Room Operations ---

  async setRoom(roomId, roomData) {
    this.rooms.set(roomId, {
      ...roomData,
      updatedAt: Date.now()
    });
  }

  async getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  async deleteRoom(roomId) {
    return this.rooms.delete(roomId);
  }

  // --- Player Session Operations ---

  async setPlayerSession(socketId, sessionData) {
    this.sessions.set(socketId, sessionData);
  }

  async getPlayerSession(socketId) {
    return this.sessions.get(socketId) || null;
  }

  async deletePlayerSession(socketId) {
    return this.sessions.delete(socketId);
  }
}

// Export a singleton instance of the store
const store = new MemoryStore();
export default store;
