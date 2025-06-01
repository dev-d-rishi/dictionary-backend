import cors from "cors";
import dotenv from "dotenv";
import app from "./app";
import { getWordDetails } from "./services/wordServices";
import connectDB from "./database";
import words from "./models/words";
import wordOfTheDay from "./models/wordOfTheDay";
import { getRandomWordFromOpenAI } from "./services/wordOfTheDay";
import authRoutes from "./routes/auth";
import allWordsRoutes from "./routes/allWords";

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
    console.log("🔍 Searching for word:", term);

    const existing = await words.findOne({ word: term });
    console.log("📦 Found existing entry:", existing ? "Yes" : "No");

    if (existing) {
      if (existing.imageURL) {
        console.log("🖼️ Image already exists, skipping prompt.");
        res.json({
          term: term,
          result: existing,
          promptId: existing.promptId || null,
        });
        return;
      }

      if (existing.promptId) {
        console.log("⚡ Prompt ID already exists, skipping prompt generation.");
        res.json({
          term: term,
          result: existing,
          promptId: existing.promptId,
        });
        return;
      }

      // const promptId = await sendPromptAPI(
      //   existing.positivePrompt,
      //   existing.negativePrompt
      // );
      // console.log("🚀 Prompt sent for existing word. ID:", promptId);

      // await words.updateOne({ word: term }, { $set: { promptId } });

      // res.json({ term: term, result: existing, promptId });
      res.json({ term: term, result: existing });
      return;
    }

    console.log("🆕 Word not found, generating new entry...");
    const wordData = await getWordDetails(term);
    console.log("📘 Generated word data:", wordData);

    // const promptId = await sendPromptAPI(
    //   wordData.positivePrompt,
    //   wordData.negativePrompt
    // );
    // console.log("🚀 Prompt sent for new word. ID:", promptId);

    // Add promptId before saving
    // wordData.promptId = promptId;

    const savedWord = await words.create(wordData);
    console.log("✅ New word saved to database with prompt ID.");

    // res.json({ term, result: savedWord, promptId });
    res.json({ term, result: savedWord });
  } catch (err) {
    console.error("❌ Error fetching word details:", err);
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

app.use('/auth', authRoutes);

app.use("/admin/allWords", allWordsRoutes);

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
