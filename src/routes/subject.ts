import express from "express";
import {
  addSubjectWords,
  assignImageToSubjectWord,
  generateImageForSubject,
  getSubjectWords,
  uploadSubjectWords,
} from "../services/subjectWord";

const router = express.Router();

// Add or update words for a subject
router.post("/add", async (req, res) => {
  try {
    const { subject, words } = req.body;

    if (!subject || !Array.isArray(words) || words.length === 0) {
      res.status(400).json({ error: "Subject and words array are required." });
      return;
    }

    const updated = await addSubjectWords(req, res);
    res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("❌ Error adding subject words:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// Get words for a subject
// routes/subject.ts
router.get("/:subject", async (req, res) => {
  console.log("🎯 Subject route hit:", req.params.subject);
  try {
    const subject = req.params.subject;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await getSubjectWords(subject, page, limit);

    if (!data) {
      res.status(404).json({ error: "Subject not found." });
      return;
    }

    res.status(200).json({ success: true, ...data });
  } catch (err: any) {
    console.error("❌ Error getting subject words:", err.message);
    res.status(500).json({ error: err.message || "Server error." });
  }
});

// Upload words list for a subject
import multer from "multer";
import fs from "fs";
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { subject } = req.body;
    const file = req.file;

    if (!subject || !file) {
      res.status(400).json({ error: "Subject and file are required." });
      return;
    }

    // Read file content and extract word list
    const content = fs.readFileSync(file.path, "utf-8");
    const words = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line);

    if (words.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }

    // Call uploadSubjectWords with subject and list of words
    const data = await generateImageForSubject(subject, words);

    // Delete the uploaded file after processing
    fs.unlinkSync(file.path);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ Error uploading subject words:", err);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/assign", upload.single("file"), async (req, res) => {
  try {
    const { subject } = req.body;
    const file = req.file;

    if (!subject || !file) {
      res.status(400).json({ error: "Subject and file are required." });
      return;
    }

    // Read file content and extract word list
    const content = fs.readFileSync(file.path, "utf-8");
    const words = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line);

    if (words.length === 0) {
      fs.unlinkSync(file.path);
      res.status(400).json({ error: "No valid words found in the file." });
      return;
    }

    // Call uploadSubjectWords with subject and list of words
    const data = await assignImageToSubjectWord(subject, words);

    // Delete the uploaded file after processing
    fs.unlinkSync(file.path);

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ Error uploading subject words:", err);
    res.status(500).json({ error: "Server error." });
  }
});

export default router;
