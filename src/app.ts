import express from "express";
import cors from "cors";

const app = express();

const allowedOrigins = [
    "https://grab-vocab.vercel.app",   // replace with your frontend domain
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

export default app;
