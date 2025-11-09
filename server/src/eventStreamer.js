// server/src/eventStreamer.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
  
const __filename = fileURLToPath(import.meta.url);   // → absolute path of the current file
const __dirname = path.dirname(__filename);          // → absolute path of the current folder

/**
 * 🚚 EventStreamer
 * -----------------
 * A simulation engine that replays trip JSON data files in real-time (or faster/slower)
 * and emits timestamp-synchronized event batches to connected Socket.IO clients.
 *
 * Each connected socket has its own "session" so users can control playback independently.
 */
export class EventStreamer {
  /**
   * @param {Server} io - socket.io server instance
   * @param {string} dataDir - directory containing trip JSON files
   * @param {number} tickMs - frequency (in ms) to check and emit new events
   */
  constructor(io, dataDir = path.resolve(__dirname, 'data', 'assessment'), tickMs = 400) {
    this.io = io;               // shared socket.io instance
    this.dataDir = dataDir;     // folder where trip files are located
    this.tickMs = tickMs;       // how often the event loop runs
    this.trips = [];            // [{ id, events: [{... , _ts}], firstTs }]
    this.sessions = new Map();  // sessionId -> simulation state
  }

  /**
   * Load and parse all trip JSON files from the data directory.
   * Each trip file is expected to be an array of event objects containing timestamps.
   */
  loadTrips() {
    if (!fs.existsSync(this.dataDir)) {
      console.warn('⚠️ EventStreamer.loadTrips: dataDir not found:', this.dataDir);
      this.trips = [];
      return;
    }

    // Read all JSON files in dataDir
    const files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));

    this.trips = files.map(file => {
      const raw = fs.readFileSync(path.join(this.dataDir, file), 'utf8');
      let events = [];
      try {
        events = JSON.parse(raw || '[]');
      } catch (err) {
        console.error('❌ Failed to parse', file, err);
        events = [];
      }

      // Precompute numeric timestamps for faster simulation
      events.forEach(e => { e._ts = new Date(e.timestamp).getTime(); });
      events.sort((a, b) => a._ts - b._ts);

      return {
        id: path.basename(file, '.json'), // file name without extension
        events,
        firstTs: events.length ? events[0]._ts : null
      };
    });

    console.log(`✅ Loaded ${this.trips.length} trip files from ${this.dataDir}`);
  }

  /**
   * Create a new streaming session for a specific socket (sessionId).
   * @param {string} sessionId - socket id or room name
   * @param {object} options
   * @param {number} [options.speed=1] - simulation speed multiplier (1 = real-time)
   * @param {string|null} [options.startAt=null] - ISO start timestamp for simulation
   */
  createSession(sessionId, { speed = 1, startAt = null } = {}) {
    // Prevent duplicates
    if (this.sessions.has(sessionId)) return;

    // Determine the base simulation start time
    const simStart = startAt
      ? new Date(startAt).getTime()
      : (this.trips.length
          ? Math.min(...this.trips.map(t => t.firstTs || Infinity))
          : Date.now());

    const session = {
      speed,                      // playback speed
      simStart,                   // simulated timeline start (in ms)
      wallStart: Date.now(),      // real wall-clock start time
      cursors: this.trips.map(() => 0), // cursor index per trip
      running: true               // session state
    };

    this.sessions.set(sessionId, session);
    this._runLoop(sessionId); // begin event streaming loop
  }

  /**
   * Main simulation loop.
   * Calculates which events fall within the current simulation window
   * and emits them as "batches" to the session’s Socket.IO room.
   */
  _runLoop(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.running) return;

    const loop = () => {
      const s = this.sessions.get(sessionId);
      if (!s || !s.running) return;

      // Determine current simulation time (real elapsed × speed)
      const elapsed = (Date.now() - s.wallStart) * s.speed;
      const simTime = s.simStart + elapsed;

      const batches = [];

      // For each trip, gather all new events whose timestamps <= simTime
      this.trips.forEach((trip, idx) => {
        const out = [];
        let c = s.cursors[idx];
        while (c < trip.events.length && trip.events[c]._ts <= simTime) {
          out.push(trip.events[c]);
          c++;
        }
        s.cursors[idx] = c;
        if (out.length) batches.push({ tripId: trip.id, events: out });
      });

      // Emit accumulated batches (if any) to this session’s socket room
      if (batches.length) {
        this.io.to(sessionId).emit('events_batch', { batches, simTime });
      }

      // Schedule the next tick
      s._timer = setTimeout(loop, this.tickMs);
    };

    loop();
  }

  /**
   * Adjust simulation playback speed dynamically.
   * Example: `setSpeed(socket.id, 2)` doubles playback rate.
   */
  setSpeed(sessionId, newSpeed) {
    const s = this.sessions.get(sessionId);
    if (!s) return;

    // Adjust simulation start to maintain timeline continuity
    const elapsed = (Date.now() - s.wallStart) * s.speed;
    s.simStart = s.simStart + elapsed;
    s.wallStart = Date.now();
    s.speed = Number(newSpeed) || 1;
  }

  /**
   * Seek to a specific simulation timestamp (ISO format).
   * Future events after the target time will continue streaming.
   */
  seek(sessionId, isoTimestamp) {
    const s = this.sessions.get(sessionId);
    if (!s) return;

    const target = new Date(isoTimestamp).getTime();
    s.simStart = target;
    s.wallStart = Date.now();

    // Move each trip's cursor to the first event after the target
    this.trips.forEach((trip, i) => {
      let idx = 0;
      while (idx < trip.events.length && trip.events[idx]._ts <= target) idx++;
      s.cursors[i] = idx;
    });
  }

  /**
   * Gracefully stop a running simulation session.
   * Clears timer and removes the session state from memory.
   */
  stopSession(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return;
    s.running = false;
    clearTimeout(s._timer);
    this.sessions.delete(sessionId);
  }
}
