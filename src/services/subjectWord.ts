// controllers/subject.ts
import { Request, Response } from "express";
import SubjectWords from "../models/subjectWords";
import multer from "multer";
import { OpenAI } from "openai";
import dotenv from "dotenv";
import { WordDetails } from "./wordServices";

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
