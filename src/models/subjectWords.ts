// models/subjectWords.ts
import mongoose from "mongoose";

const subjectWordsSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  words: {
    type: [
      {
        word: { type: String, required: true },
        partOfSpeech: String,
        pronunciation: String,
        wordForms: [String],
        meaning: String,
        exampleSentence: String,
        synonyms: [String],
        antonyms: [String],
        memoryTrick: String,
        origin: String,
        positivePrompt: String,
        negativePrompt: String,
        imageURL: String,
        promptId: String,
      },
    ],
    default: [],
  },
});

const SubjectWords = mongoose.model("subject_words", subjectWordsSchema);
export default SubjectWords;
