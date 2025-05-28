import axios from "axios";
import PromptJSON from "../mock/prompt.json";

export async function sendPromptAPI(positive: string, negative: string) {
  // PromptJSON
  PromptJSON.prompt["6"].inputs.text = positive;
  PromptJSON.prompt["7"].inputs.text = negative;
  try {
    const response = await axios.post("http://0.0.0.0:8188/prompt");
    console.log("Prompt response:", response.data);
    return response.data.prompt_id;
  } catch (error) {
    console.error("Error sending prompt:", error);
    return null;
  }
}

export async function getPromptHistory(promptId: string) {
  try {
    const response = await axios.get(`http://0.0.0.0:8188/history/${promptId}`);
    console.log("Prompt history response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching prompt history:", error);
    return null;
  }
}

export async function getImage(filename: string) {
  try {
    const response = await axios.get(`http://0.0.0.0:8188/view`, {
      params: { filename },
      responseType: "blob", // to handle image
    });

    // Create a local object URL to display the image
    return URL.createObjectURL(response.data);
  } catch (error) {
    console.error("Error fetching image:", error);
    return null;
  }
}
