import fs from "fs";
import path from "path";

export function startEventSimulation(io) {
  // Path where your event JSON files are stored
  const dataDir = path.join(process.cwd(), "data");

  // List of event file names (you can include all 15)
  const eventFiles = [
    "battery_low.json",
    "device_error.json",
    "fuel_level_low.json",
    "location_ping.json",
    "refueling_completed.json",
    "refueling_started.json",
    "signal_lost.json",
    "signal_recovered.json",
    "speed_violation.json",
    "trip_cancelled.json",
    "trip_completed.json",
    "trip_started.json",
    "vehicle_moving.json",
    "vehicle_stopped.json",
    "vehicle_telemetry.json"
  ];

  console.log("🚀 Starting Fleet Event Simulation...");

  setInterval(() => {
    // Pick a random event
    const randomFile = eventFiles[Math.floor(Math.random() * eventFiles.length)];
    const filePath = path.join(dataDir, randomFile);

    // Read & parse it
    const eventData = JSON.parse(fs.readFileSync(filePath, "utf8"));

    // Randomize a few fields
    eventData.event_id = "evt_" + Math.floor(Math.random() * 100000);
    eventData.timestamp = new Date().toISOString();
    eventData.vehicle_id = "VH_" + Math.floor(100 + Math.random() * 900);

    // Emit over socket
    io.emit("fleet_event", eventData);
    console.log("📡 Sent event:", eventData.event_type);
  }, 3000); // every 3 seconds
}
