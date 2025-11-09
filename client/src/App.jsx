import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";
import { SERVER_URL } from "./config";

const socket = io(SERVER_URL, { transports: ["websocket"] });

export default function App() {
  const [events, setEvents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 10;
  const maxEvents = 100; // Keep last 100 events

  useEffect(() => {
    socket.on("connect", () => console.log("✅ Connected:", socket.id));
    socket.on("disconnect", () => console.log("❌ Disconnected"));

    socket.on("events_batch", (payload) => {
      const newEvents = payload.batches.flatMap((b) => b.events);
      setEvents((prev) => {
        const combined = [...newEvents, ...prev]; // Newest first
        return combined.slice(0, maxEvents); // Keep only latest 100
      });
      setCurrentPage(1); // Always show live events on first page
    });

    return () => socket.off("events_batch");
  }, []);

  // Pagination logic
  const totalPages = Math.ceil(events.length / eventsPerPage) || 1;
  const paginatedEvents = events.slice(
    (currentPage - 1) * eventsPerPage,
    currentPage * eventsPerPage
  );

  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));

  const rowColor = (type) => {
    switch (type) {
      case "trip_started":
        return "#d4f4dd";
      case "trip_completed":
        return "#cfe0fc";
      case "trip_cancelled":
        return "#f8d7da";
      case "speed_violation":
        return "#ffe5b4";
      case "battery_low":
      case "fuel_level_low":
        return "#fbe5a2";
      default:
        return "#f0f0f0";
    }
  };

  return (
    <div className="dashboard">
      <header>
        <h1>🚚 Fleet Tracking Dashboard</h1>
        <p>Live Simulation — Showing max 10 events per page, last 100 events</p>
      </header>

      <main className="events-table-container">
        {events.length === 0 ? (
          <p className="no-events">Waiting for trip data...</p>
        ) : (
          <>
            <table className="events-table">
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Vehicle</th>
                  <th>Time</th>
                  <th>Location</th>
                  <th>Distance (km)</th>
                  <th>Battery (%)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEvents.map((evt) => (
                  <tr
                    key={evt.event_id}
                    style={{ backgroundColor: rowColor(evt.event_type) }}
                  >
                    <td>{evt.event_type || "-"}</td>
                    <td>{evt.vehicle_id || "-"}</td>
                    <td>
                      {evt.timestamp
                        ? new Date(evt.timestamp).toLocaleTimeString()
                        : "-"}
                    </td>
                    <td>
                      {evt.location
                        ? `${evt.location.lat.toFixed(4)}, ${evt.location.lng.toFixed(4)}`
                        : "-"}
                    </td>
                    <td>{evt.distance_travelled_km ?? "-"}</td>
                    <td>{evt.device?.battery_level ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination">
              <button onClick={handlePrev} disabled={currentPage === 1}>
                Prev
              </button>
              <span>
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
