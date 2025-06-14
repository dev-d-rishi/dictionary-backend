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

      let existing = await words.findOne({ word: term });

      if (existing) {
        if (existing.imageURL) {
          results.push({
            term,
            result: existing,
            promptId: existing.promptId || null,
          });
          continue;
        }
        console.log(
          `🆕 Word "${term}" found, checking for prompt ID...: ${existing.exampleSentence}`
        );
        const promptId = await sendPromptAPI(existing.exampleSentence);

        await words.updateOne({ word: term }, { $set: { promptId } });
        existing.promptId = promptId;
        results.push({ term, result: {word: existing.word}, promptId });
        continue;
      }

      const wordData = await getWordDetails(term);

      console.log(
        `🆕 Word "${term}" found, checking for prompt ID...: ${wordData.exampleSentence}`
      );
      const promptId = await sendPromptAPI(wordData.exampleSentence);

      wordData.word = term;
      wordData.promptId = promptId;

      const savedWord = await words.create(wordData);

      results.push({ term, result: {word: savedWord.word}, promptId });
    }

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error("❌ Error processing words:", err);
    res.status(500).json({ error: "Something went wrong." });
  }
};

const waitForImageFilename = async (
  promptId: string,
  retries = 1,
  delay = 4000
): Promise<string | null> => {
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

export const getImagesByWords = async (req: Request, res: Response) => {
  try {
    const { words: wordList } = req.body;

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

        // Use the word as the filename for S3
        const cleanFilename = `${word.toLowerCase().replace(/\s+/g, "_")}.png`;
        const s3URL = await uploadImageToS3(imageURL, cleanFilename);

        const updated = await words.findOneAndUpdate(
          { word: new RegExp(`^${word}$`, "i") },
          { $set: { imageURL: s3URL } },
          { new: true }
        );

        results.push({
          word,
          imageURL: s3URL,
          status: "success",
          updated,
        });
      } catch (err: any) {
        console.error(`❌ Error for word "${word}":`, err);
        results.push({ word, status: "error", message: err.message });
      }
    }

    res.json({ results });
    return;
  } catch (err) {
    console.error("❌ Error in getImagesByWords:", err);
    res.status(500).json({ error: "Server error while processing words" });
  }
};