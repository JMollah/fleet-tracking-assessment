// server/scripts/test-client.mjs
import { io } from "socket.io-client";

const socket = io("http://localhost:4000");

socket.on("connect", () => {
  console.log("connected", socket.id);
});

socket.on("events_batch", ({ batches, simTime }) => {
  console.log("batch at simTime:", new Date(simTime).toISOString());
  batches.forEach(b => {
    console.log(`  trip ${b.tripId}: ${b.events.length} events (first ts: ${b.events[0]?.timestamp})`);
  });
});

socket.on("disconnect", () => {
  console.log("disconnected");
});
