require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const ttsRoutes = require("./routes/tts.routes");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  })
);
app.use(express.json({ limit: "2mb" }));

app.use("/api/tts", ttsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "not_found", message: "Route not found." });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Voice Agent backend listening on http://localhost:${PORT}`);
  if (!process.env.ELEVENLABS_API_KEY) {
    console.warn(
      "WARNING: ELEVENLABS_API_KEY is not set. Voice generation requests will fail until it is configured in backend/.env"
    );
  }
});
