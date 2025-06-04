import express from "express";
import { getWordDetails } from "../services/wordServices";
import words from "../models/words";

const router = express.Router();

router.get("/:term", async (req, res) => {
  try {
    const term = req.params.term.toLowerCase();

    const existing = await words.findOne({ word: term });
    // if (existing) return res.json(existing);
    //console.log("Existing word:", existing);

    const wordData = await getWordDetails(term);
    //console.log("Word data to be saved:", wordData);

    const saved = await words.create(wordData);
    //console.log("Word saved successfully:", saved); // ✅ Confirmation log

    res.json(saved);
  } catch (err) {
    console.error("Error saving word:", err); // 🔴 Shows specific error
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;