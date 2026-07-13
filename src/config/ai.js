import dotenv from "dotenv";
dotenv.config();

const aiConfig = {
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    apiKey: process.env.NVIDIA_API_KEY,
  },

  models: {
    userChat: {
      name: "google/gemma-2-2b-it",
      temperature: 0.2,
      topP: 0.7,
      maxTokens: 1024,
      stream: false,
    },
    adminChat: {
      name: "meta/llama-3.1-8b-instruct",
      temperature: 0.5,
      topP: 0.8,
      maxTokens: 2048,
      stream: false,
    },
  },

  getHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.nvidia.apiKey}`,
      Accept: "application/json",
    };
  },
};

export default aiConfig;
