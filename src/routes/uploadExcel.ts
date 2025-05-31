// routes/uploadExcel.ts
import axios from "axios";
import express from "express";
import multer from "multer";
import xlsx from "xlsx";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/upload-excel", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Parse buffer using xlsx
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
    });

    const flatWords = data.flat().filter(Boolean);
    const uniqueWords = Array.from(
      new Set(flatWords.map((w) => String(w).trim().toLowerCase()))
    );

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
    console.error("Excel Upload Error:", error.response.data);
    res.status(500).json({ error: "Failed to read Excel file" });
  }
});

export default router;
