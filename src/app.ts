import express from "express";
import cors from "cors";
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100, // limit each IP to 100 requests per window
});

const app = express();

const allowedOrigins = [
    "https://grab-vocab.vercel.app",   // replace with your frontend domain
    "http://localhost:5173",          // replace with your frontend domain
  ];
  
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    }
  };

app.use(cors(corsOptions));
app.use(express.json());
app.set('trust proxy', 1);
// app.use(limiter); // Apply rate limiting to all requests

export default app;
