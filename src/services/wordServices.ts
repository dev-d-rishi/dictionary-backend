import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface WordDetails {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  wordForms: string[];
  meaning: string;
  exampleSentence: string;
  synonyms: string[];
  antonyms: string[];
  memoryTrick: string;
  origin: string;
  positivePrompt: string;
  negativePrompt: string;
  promptId?: string; // Optional, for image generation service
}

export async function getWordDetails(word: string): Promise<WordDetails> {
  const prompt = `
    Provide a detailed dictionary-style breakdown of the word: "${word}". 
    Format your response as a valid JSON object with the following keys exactly:

    {
        "word": string,                // The word itself
        "partOfSpeech": string,        // Part of speech
        "pronunciation": string,       // IPA notation if possible
        "wordForms": string[],         // List of plural or other forms
        "meaning": string,             // The most accurate meaning / definition
        "exampleSentence": string,     // Example sentence using the word
        "synonyms": string[],          // List of 3 to 5 synonyms
        "antonyms": string[],          // List of antonyms (if available)
        "memoryTrick": string,         // A memory trick or way to remember the word
        "origin": string,              // Short origin story or etymology
        "positivePrompt": string,      // Describe a detailed, realistic, cinematic-quality scene that visually represents the meaning or emotion of the word. Use vivid imagery and natural elements (e.g., "A lone tree standing strong in a stormy field, under a dramatic sky").
        "negativePrompt": string       // Describe what to avoid in the generated image (e.g., "blurry, unrealistic anatomy, extra limbs, cartoon style, text, distorted faces").
    }

    Make sure the JSON is correctly formatted with double quotes, no extra text outside the JSON object, and all keys are present (use empty strings or empty arrays if some info is missing).
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
