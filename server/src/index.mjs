// server/src/index.mjs
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { EventStreamer } from "./eventStreamer.js"; // <-- import your new class
import { startEventSimulation } from "./eventGenerator.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = 4000;

// ✅ Initialize EventStreamer
const dataDir = path.resolve(__dirname, "../data/assessment"); // folder containing trip_xxx.json files
const streamer = new EventStreamer(io, dataDir, 500); // emits every 500ms
streamer.loadTrips();

// 🧩 WebSocket setup
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // Create a simulation session for this socket
  streamer.createSession(socket.id, { speed: 1 });

  // Allow frontend to control simulation speed
  socket.on("set_speed", (speed) => {
    console.log(`⚙️  Speed changed to ${speed}x`);
    streamer.setSpeed(socket.id, speed);
  });

  // Allow frontend to jump to a specific time
  socket.on("seek_to", (timestamp) => {
    console.log(`⏩ Seek to ${timestamp}`);
    streamer.seek(socket.id, timestamp);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    streamer.stopSession(socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("Fleet Tracking Server is running!");
});

startEventSimulation(io);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
