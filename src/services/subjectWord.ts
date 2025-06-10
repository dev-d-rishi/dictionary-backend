// controllers/subject.ts
import { Request, Response } from "express";
import SubjectWords from "../models/subjectWords";
import multer from "multer";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import { WordDetails } from "./wordServices";
import {
  getImage,
  getPromptHistory,
  sendPromptAPI,
  uploadImageToS3,
} from "./generateImageWithComfyUI";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add or update words for a subject
export const addSubjectWords = async (req: Request, res: Response) => {
  try {
    const { subject, words } = req.body;

    if (!subject || !Array.isArray(words) || words.length === 0) {
      return res
        .status(400)
        .json({ error: "Subject and words array are required." });
    }

    const updated = await SubjectWords.findOneAndUpdate(
      { subject: new RegExp(`^${subject}$`, "i") },
      { $set: { subject }, $push: { words: { $each: words } } },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ Error adding subject words:", err);
    res.status(500).json({ error: "Server error." });
  }
};

// Get subject words with their meaning
export const getSubjectWords = async (req: Request, res: Response) => {
  try {
    const subject = req.params.subject;

    if (!subject) {
      return res.status(400).json({ error: "Subject is required." });
    }

    const result = await SubjectWords.findOne({
      subject: new RegExp(`^${subject}$`, "i"),
    });

    if (!result) {
      return res.status(404).json({ error: "Subject not found." });
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("❌ Error fetching subject words:", err);
    res.status(500).json({ error: "Server error." });
  }
};

export const uploadSubjectWords = async (
  subject: string,
  wordList: string[]
) => {
  try {
    const cleanedWords = wordList
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    // Get existing words for the subject
    const existingEntry = await SubjectWords.findOne({
      subject: new RegExp(`^${subject}$`, "i"),
    });

    const existingWords = new Set<string>(
      (existingEntry?.words || []).map((w: any) => w.word.toLowerCase())
    );

    const addedWords: any[] = [];
    const skippedWords: string[] = [];

    for (const word of cleanedWords) {
      if (existingWords.has(word)) {
        skippedWords.push(word);
      } else {
        const wordDetails = await getWordDetailsInContext(word, subject);
        addedWords.push(wordDetails);
      }
    }

    // Insert only new words
    const updated = await SubjectWords.findOneAndUpdate(
      { subject: new RegExp(`^${subject}$`, "i") },
      { $set: { subject }, $push: { words: { $each: addedWords } } },
      { new: true, upsert: true }
    );

    return {
      updated,
      addedWords: addedWords.map((w) => w.word),
      skippedWords,
    };
  } catch (err) {
    console.error("❌ Error in uploadSubjectWords:", err);
    throw err;
  }
};

export const generateImageForSubject = async (
  subject: string,
  wordList: string[]
) => {
  try {
    const cleanedWords = wordList
      .map((w) => w.trim().toLowerCase())
      .filter(Boolean);

    const subjectEntry = await SubjectWords.findOne({
      subject: new RegExp(`^${subject}$`, "i"),
    });

    if (!subjectEntry) {
      throw new Error(`Subject "${subject}" not found`);
    }

    const results = [];

    for (const term of cleanedWords) {
      const existingWord = subjectEntry.words.find(
        (w: any) => w.word.toLowerCase() === term
      );

      if (!existingWord) {
        results.push({ term, error: "Word not found in subject." });
        continue;
      }

      // Skip if imageURL exists
      if (existingWord.imageURL) {
        results.push({
          term,
          result: { word: existingWord.word },
          promptId: existingWord.promptId || null,
        });
        continue;
      }

      const promptId = await sendPromptAPI(existingWord.exampleSentence ?? "");

      existingWord.promptId = promptId;
      // You could also add `imageURL` here after generating the image externally

      results.push({
        term,
        result: { word: existingWord.word },
        promptId,
      });
    }

    // Save changes
    await subjectEntry.save();

    return {
      success: true,
      subject,
      data: results,
    };
  } catch (error) {
    console.error("❌ Error generating image for subject:", error);
    throw error;
  }
};

export const assignImageToSubjectWord = async (
  subject: string,
  wordList: string[]
) => {
  try {
    const results: any[] = [];

    const subjectDoc = await SubjectWords.findOne({ subject: new RegExp(`^${subject}$`, "i") });
    if (!subjectDoc) {
      throw new Error(`Subject "${subject}" not found`);
    }

    for (const word of wordList) {
      const wordObj = subjectDoc.words.find((w: any) =>
        w.word.toLowerCase() === word.toLowerCase()
      );

      if (!wordObj || wordObj.imageURL) {
        results.push({ word, status: "skipped", reason: "Image already exists" });
        continue;
      }

      if (!wordObj || !wordObj.promptId) {
        results.push({ word, status: "skipped", reason: "promptId not found" });
        continue;
      }

      const filename = await waitForImageFilename(wordObj.promptId);
      if (!filename) {
        results.push({ word, status: "pending", reason: "Image not ready" });
        continue;
      }

      const imageURL = await getImage(filename);
      if (!imageURL) {
        results.push({ word, status: "failed", reason: "Failed to retrieve image URL" });
        continue;
      }

      const imageAWSURL = await uploadImageToS3(imageURL, filename);

      const updated = await SubjectWords.findOneAndUpdate(
        {
          subject: new RegExp(`^${subject}$`, "i"),
          "words.word": new RegExp(`^${word}$`, "i"),
        },
        {
          $set: { "words.$.imageURL": imageAWSURL },
        },
        { new: true }
      );

      results.push({ word, status: "success", imageURL: imageAWSURL, updated });
    }

    return { subject, status: "done", results };
  } catch (error) {
    console.error("❌ Error in assignImageToSubjectWord:", error);
    throw new Error("Failed to assign images to subject words");
  }
};

const waitForImageFilename = async (
  promptId: string,
  retries = 150,
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

async function getWordDetailsInContext(word: string, subject: string) {
  const subjectPrompt = `The word '${word}' is used in the context of the subject '${subject}'.`;

  const prompt = `
    ${subjectPrompt}
    Provide a detailed dictionary-style breakdown of the word: "${word}" in the context of '${subject}'.
    Format your response as a valid JSON object with these exact keys:

    {
      "word": string,
      "partOfSpeech": string,
      "pronunciation": string,
      "wordForms": string[],
      "meaning": string,
      "exampleSentence": string,
      "synonyms": string[],
      "antonyms": string[],
      "memoryTrick": string,
      "origin": string,
      "positivePrompt": string,
      "negativePrompt": string
    }

    Format strictly as valid JSON with double quotes, and all fields present.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.choices[0].message.content || "";

  try {
    // Parse the entire response as JSON
    const data: WordDetails = JSON.parse(text);
    return data;
  } catch (err) {
    console.error("Failed to parse JSON response:", err);
    // Return fallback with some defaults, or throw error as needed
    return {
      word,
      partOfSpeech: "",
      pronunciation: "",
      wordForms: [],
      meaning: "",
      exampleSentence: "",
      synonyms: [],
      antonyms: [],
      memoryTrick: "",
      origin: "",
      positivePrompt: "",
      negativePrompt: "",
    };
  }
}
