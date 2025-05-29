import words from "../../models/words";

// Fetch all words with pagination and optional search
export async function getAllWords({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const skip = (page - 1) * limit;
  const query = search
    ? { word: { $regex: new RegExp(search, "i") } }
    : {};

  const [wordsArray, total] = await Promise.all([
    words.find(query).skip(skip).limit(limit).sort({ word: 1 }),
    words.countDocuments(query),
  ]);

  return {
    wordsArray,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// Delete a word by its text value
export async function deleteWord(word: string) {
  const deleted = await words.findOneAndDelete({ word });
  return !!deleted;
}