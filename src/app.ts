import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

const app = express();

const allowedOrigins = [
  "https://grab-vocab.vercel.app", // production frontend
  "http://localhost:5173", // dev frontend
];

const corsOptions: cors.CorsOptions = {
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions)); // ✅ Enable CORS
app.use(express.json());
app.set("trust proxy", 1);
// app.use(limiter);                  // Optional: re-enable if needed

export default app;
