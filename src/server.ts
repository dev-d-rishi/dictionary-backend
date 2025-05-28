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
  uploadImageToS3,
} from "./services/generateImageWithComfyUI";
import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import axios from "axios";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: "eu-north-1", // your region
});

const s3 = new AWS.S3();

// Load environment variables

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

      const promptId = await sendPromptAPI(
        existing.positivePrompt,
        existing.negativePrompt
      );
      console.log("🚀 Prompt sent for existing word. ID:", promptId);

      await words.updateOne({ word: term }, { $set: { promptId } });

      res.json({ term: term, result: existing, promptId });
      return;
    }

    console.log("🆕 Word not found, generating new entry...");
    const wordData = await getWordDetails(term);
    console.log("📘 Generated word data:", wordData);

    const promptId = await sendPromptAPI(
      wordData.positivePrompt,
      wordData.negativePrompt
    );
    console.log("🚀 Prompt sent for new word. ID:", promptId);

    // Add promptId before saving
    wordData.promptId = promptId;

    const savedWord = await words.create(wordData);
    console.log("✅ New word saved to database with prompt ID.");

    res.json({ term, result: savedWord, promptId });
  } catch (err) {
    console.error("❌ Error fetching word details:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// app.get("/saveImage", async (req, res) => {
//   try {
//     const { filename } = req.query;
//     if (!filename) {
//       res.status(400).json({ error: "Missing filename in query." });
//       return;
//     }

//     // const imageUrl = `http://0.0.0.0:8188/api/view?filename=${filename}`;

//     const imageURL = await uploadImageToS3(filename, filename);
//     console.log("✅ Image uploaded to S3:", imageURL);
//     res.json({ success: true, imageURL });
//     return;
//   } catch (err) {
//     console.error("❌ Error uploading image to S3:", err);
//     res.status(500).json({ error: "Failed to upload image." });
//   }
// });

app.get("/getImageURL/:promptId/:word", async (req, res) => {
  try {
    const { promptId, word } = req.params;
    console.log("Received request to get image URL");
    console.log("Prompt ID:", promptId);
    console.log("Word:", word);

    const waitForImageFilename = async (
      promptId: string,
      retries = 150,
      delay = 4000
    ) => {
      for (let i = 0; i < retries; i++) {
        console.log(`Polling attempt ${i + 1}...`);
        const history = await getPromptHistory(promptId);
        const outputNode = history?.[promptId]?.outputs?.["9"];

        if (!outputNode) {
          console.log("No output node found in history yet.");
        }

        if (outputNode?.images?.length > 0 && outputNode.images[0].filename) {
          console.log("Image filename found:", outputNode.images[0].filename);
          return outputNode.images[0].filename;
        }

        console.log("Image not ready, waiting...");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return null;
    };

    const filename = await waitForImageFilename(promptId);
    if (!filename) {
      console.log("Image filename not available after polling.");
      res.status(202).json({ message: "Image not ready", status: "pending" });
      return;
    }

    console.log("Fetching image using filename:", filename);
    const imageURL = await getImage(filename);

    if (!imageURL) {
      console.log("Failed to retrieve image URL from getImage.");
      res.status(500).json({ error: "Failed to retrieve image URL" });
      return;
    }
    const imageAWSURL = await uploadImageToS3(imageURL, filename);
    console.log("Updating word document with imageURL...");
    const updated = await words.findOneAndUpdate(
      { word: new RegExp(`^${word}$`, "i") },
      { $set: { imageURL: imageAWSURL } },
      { new: true }
    );

    console.log("Image URL successfully retrieved and saved:");
    res.json({ word, imageURL, status: "success", updated });
    return;
  } catch (err) {
    console.error("Error in getImageURL:", err);
    res.status(500).json({ error: "Failed to fetch image" });
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
