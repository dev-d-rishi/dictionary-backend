// routes/uploadExcel.ts
import axios from "axios";
import express from "express";
import multer from "multer";
import xlsx from "xlsx";

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    let uniqueWords: string[] = [];

    // Handle Excel files
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      const workbook = xlsx.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });
      const flatWords = data.flat().filter(Boolean);
      uniqueWords = Array.from(
        new Set(flatWords.map((w) => String(w).trim().toLowerCase()))
      );
    }

    // Handle .txt files
    else if (file.mimetype === "text/plain") {
      const text = file.buffer.toString("utf-8");
      const words = text
        .split(/\r?\n/) // split by lines
        .flatMap((line) => line.split(",")) // further split by comma
        .map((w) => w.trim())
        .filter(Boolean);

      uniqueWords = Array.from(new Set(words.map((w) => w.toLowerCase())));
    } else {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    if (uniqueWords.length === 0) {
      res.status(400).json({ error: "No valid words found in file" });
      return;
    }

    const response = await axios.post(
      "http://localhost:5006/admin/allWords/define-many",
      { words: uniqueWords }
    );

    res.json({ words: response.data });
  } catch (error: any) {
    console.error("File Upload Error:", error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message || "Failed to process file" });
  }
});

router.post("/assign-image", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    let uniqueWords: string[] = [];

    // Handle Excel files
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel"
    ) {
      const workbook = xlsx.read(file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
      });
      const flatWords = data.flat().filter(Boolean);
      uniqueWords = Array.from(
        new Set(flatWords.map((w) => String(w).trim().toLowerCase()))
      );
    }

    // Handle .txt files
    else if (file.mimetype === "text/plain") {
      const text = file.buffer.toString("utf-8");
      const words = text
        .split(/\r?\n/) // split by lines
        .flatMap((line) => line.split(",")) // further split by comma
        .map((w) => w.trim())
        .filter(Boolean);

      uniqueWords = Array.from(new Set(words.map((w) => w.toLowerCase())));
    } else {
      res.status(400).json({ error: "Unsupported file type" });
      return;
    }

    if (uniqueWords.length === 0) {
      res.status(400).json({ error: "No valid words found in file" });
      return;
    }

    const response = await axios.post(
      "http://localhost:5006/admin/allWords/getImagesByWords",
      { words: uniqueWords }
    );

    res.json({ words: response.data });
  } catch (error: any) {
    console.error("File Upload Error:", error?.response?.data || error.message);
    res.status(500).json({ error: error?.response?.data || error.message || "Failed to process file" });
  }
});

export default router;
