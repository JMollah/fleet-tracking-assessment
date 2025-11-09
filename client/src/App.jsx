import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "./config";

const socket = io(SERVER_URL, {
  transports: ["websocket"],
});

export default function App() {
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    socket.on("connect", () => console.log("✅ Connected:", socket.id));
    socket.on("disconnect", () => console.log("❌ Disconnected"));

    // 👇 this is where the EventStreamer sends data
    socket.on("events_batch", (payload) => {
      console.log("📦 Received:", payload);
      setBatches((prev) => [...prev, payload]);
    });

    return () => {
      socket.off("events_batch");
    };
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>🚚 Fleet Tracking Dashboard</h1>
      <h3>Live Simulation</h3>
      {batches.length === 0 ? (
        <p>Waiting for trip data...</p>
      ) : (
        <ul>
          {batches.slice(-10).map((batch, i) => (
            <li key={i}>
              <strong>{new Date(batch.simTime).toLocaleTimeString()}</strong> —{" "}
              {batch.batches.length} trips updated
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
