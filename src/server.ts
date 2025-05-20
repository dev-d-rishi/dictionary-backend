import cors from "cors";
import dotenv from "dotenv";
import app from "./app";
import { getWordDetails } from "./services/wordServices";
import connectDB from "./database";
import words from "./models/words";
import wordOfTheDay from "./models/wordOfTheDay";
import { getRandomWordFromOpenAI } from "./services/wordOfTheDay";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Default route
app.get("/", (req, res) => {
  res.send("Welcome to Dictionary!");
});

// Test route
app.get("/hello", (req, res) => {
  res.send("Hello response!");
});

app.get("/define/:word", async (req, res) => {
  try {
    const term = req.params.word.toLowerCase();
    const wordData = await getWordDetails(term);

    const existing = await words.findOne({ word: term });
    if (existing) {
      res.json({ word: term, result: existing });
      return;
    }
    await words.create(wordData);
    res.json({ term, result: wordData });
    return;
  } catch (err) {
    console.error("Error fetching word details:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.get("/wordoftheday", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD

    // Check if today's word is already saved
    const existing = await wordOfTheDay.findOne({ date: today });
    if (existing) {
      res.json({ word: existing.word, meaning: existing.meaning, date: today });
      return;
    }
    // Get random word from OpenAI
    const randomWord = await getRandomWordFromOpenAI();
    const wordData = await getWordDetails(randomWord);

    // Save to WordOfDay collection
    const saved = await wordOfTheDay.create({
      word: wordData.word,
      meaning: wordData.meaning,
      date: today,
    });

    res.json({ word: saved.word, meaning: saved.meaning, date: today });
    return;
  } catch (error) {
    console.error("Word of the Day error:", error);
    res.status(500).json({ error: "Could not fetch word of the day" });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
