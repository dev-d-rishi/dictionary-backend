import { Request, Response } from "express";
import words from "../../models/words";
import {
  getImage,
  getPromptHistory,
  sendPromptAPI,
  uploadImageToS3,
} from "../generateImageWithComfyUI";
import { getWordDetails } from "../wordServices";

export const defineManyWords = async (req: Request, res: Response) => {
  const { words: wordArray } = req.body;

  if (!Array.isArray(wordArray) || wordArray.length === 0) {
    return res.status(400).json({ error: "Please provide an array of words." });
  }

  try {
    const results = [];

    for (const termRaw of wordArray) {
      const term = termRaw.toLowerCase();
      console.log("🔍 Searching for word:", term);

      let existing = await words.findOne({ word: term });
      console.log("📦 Found existing entry:", existing ? "Yes" : "No");

      if (existing) {
        if (existing.imageURL || existing.promptId) {
          console.log("⚡ Skipping image/prompt generation for:", term);
          results.push({
            term,
            result: existing,
            promptId: existing.promptId || null,
          });
          continue;
        }

        const promptId = await sendPromptAPI(
          existing.positivePrompt,
          existing.negativePrompt
        );
        console.log("🚀 Prompt sent for existing word. ID:", promptId);

        await words.updateOne({ word: term }, { $set: { promptId } });
        existing.promptId = promptId;
        results.push({ term, result: existing, promptId });
        continue;
      }

      console.log("🆕 Word not found, generating new entry...");
      const wordData = await getWordDetails(term);
      console.log("📘 Generated word data:", wordData);

      const promptId = await sendPromptAPI(
        wordData.positivePrompt,
        wordData.negativePrompt
      );
      console.log("🚀 Prompt sent for new word. ID:", promptId);

      wordData.word = term;
      wordData.promptId = promptId;

      const savedWord = await words.create(wordData);
      console.log("✅ New word saved:", term);

      results.push({ term, result: savedWord, promptId });
    }

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error("❌ Error processing words:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const waitForImageFilename = async (
  promptId: string,
  retries = 150,
  delay = 4000
): Promise<string | null> => {
  for (let i = 0; i < retries; i++) {
    console.log(`Polling [${promptId}] - Attempt ${i + 1}`);
    const history = await getPromptHistory(promptId);
    const outputNode = history?.[promptId]?.outputs?.["9"];

    if (outputNode?.images?.length > 0 && outputNode.images[0].filename) {
      return outputNode.images[0].filename;
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  return null;
};

export const getImagesByWords = async (req: Request, res: Response) => {
  try {
    const { wordList } = req.body;

    if (!Array.isArray(wordList) || wordList.length === 0) {
      return res
        .status(400)
        .json({ error: "Request body must be a non-empty array of words" });
    }

    const results = [];

    for (const word of wordList) {
      try {
        const wordDoc = await words.findOne({
          word: new RegExp(`^${word}$`, "i"),
        });

        if (!wordDoc || !wordDoc.promptId) {
          results.push({
            word,
            status: "skipped",
            reason: "Not found or no promptId",
          });
          continue;
        }

        const filename = await waitForImageFilename(wordDoc.promptId);
        if (!filename) {
          results.push({
            word,
            status: "pending",
            reason: "Image not ready yet",
          });
          continue;
        }

        const imageURL = await getImage(filename);
        if (!imageURL) {
          results.push({
            word,
            status: "failed",
            reason: "Failed to fetch image",
          });
          continue;
        }

        const s3URL = await uploadImageToS3(imageURL, filename);
        const updated = await words.findOneAndUpdate(
          { word: new RegExp(`^${word}$`, "i") },
          { $set: { imageURL: s3URL } },
          { new: true }
        );

        results.push({ word, imageURL: s3URL, status: "success", updated });
      } catch (err: any) {
        console.error(`❌ Error for word "${word}":`, err);
        results.push({ word, status: "error", message: err.message });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error("❌ Error in getImagesByWords:", err);
    res.status(500).json({ error: "Server error while processing words" });
  }
};
