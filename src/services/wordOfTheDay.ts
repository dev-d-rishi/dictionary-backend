import { OpenAI } from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getRandomWordFromOpenAI(): Promise<string> {
  const prompt =
    "Give me a single rare English word (no meaning), one word only.";
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
  });
  console.log("Response from OpenAI:", response);
  const word = response.choices[0].message.content || "";
  return word;
}
