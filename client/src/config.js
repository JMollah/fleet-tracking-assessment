const isProd = import.meta.env.PROD;

export const SERVER_URL = isProd
  ? "https://fleet-tracking-server.onrender.com" // your deployed backend
  : "http://localhost:4000"; // local backend
