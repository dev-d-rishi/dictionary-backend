// routes/allWords.ts
import express from "express";
import { getAllWords, deleteWord } from "../services/admin/allWords";

const router = express.Router();

// GET /allWords?page=1&limit=10&search=word
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || "";

    const result = await getAllWords({ page, limit, search });
    res.json(result);
  } catch (err) {
    console.error("❌ Error in /allWords:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /allWords?word=example
router.delete("/", async (req, res) => {
  try {
    const word = req.query.word as string;
    if (!word) {
      res.status(400).json({ error: "Missing 'word' param" });
      return;
    }

    const success = await deleteWord(word);
    res.json({ success });
  } catch (err) {
    console.error("❌ Error deleting word:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;