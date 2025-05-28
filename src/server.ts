import cors from "cors";
import dotenv from "dotenv";
import app from "./app";
import { getWordDetails } from "./services/wordServices";
import connectDB from "./database";
import words from "./models/words";
import wordOfTheDay from "./models/wordOfTheDay";
import { getRandomWordFromOpenAI } from "./services/wordOfTheDay";
import {
  getImage,
  getPromptHistory,
  sendPromptAPI,
} from "./services/generateImageWithComfyUI";

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
    const existing = await words.findOne({ word: term });
    if (existing) {
      res.json({ word: term, result: existing });
      return;
    }
    const wordData = await getWordDetails(term);
    const promptId = await sendPromptAPI(
      wordData.positivePrompt,
      wordData.negativePrompt
    );
    console.log(
      "Prompt ID:",
      promptId,
      wordData.positivePrompt,
      wordData.negativePrompt
    );
    await words.create(wordData);
    res.json({ term, result: wordData, promptId: promptId });
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

app.get("/getImageURL/:promptId/:word", async (req, res) => {
  try {
    const { promptId, word } = req.params;

    const waitForImageFilename = async (
      promptId: string,
      retries = 15,
      delay = 4000
    ) => {
      for (let i = 0; i < retries; i++) {
        const history = await getPromptHistory(promptId);
        const outputNode = history?.[promptId]?.outputs?.["9"];

        if (outputNode?.images?.length > 0 && outputNode.images[0].filename) {
          return outputNode.images[0].filename;
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return null;
    };

    const filename = await waitForImageFilename(promptId);
    if (!filename) {
      res.status(202).json({ message: "Image not ready", status: "pending" });
      return;
    }

    const imageURL = await getImage(filename);
    if (!imageURL) {
      res.status(500).json({ error: "Failed to retrieve image URL" });
      return;
    }

    const updated = await words.findOneAndUpdate(
      { word: word.toLowerCase() },
      { $set: { imageURL } },
      { new: true }
    );

    res.json({ word, imageURL, status: "success", updated });
    return;
  } catch (err) {
    console.error("Error in getImageURL:", err);
    res.status(500).json({ error: "Failed to fetch image" });
  }
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
