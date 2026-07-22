import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

export const createLLM = (config = {}) => {
  const {
    model = process.env.ZHIPU_MODEL,
    apiKey = process.env.ZHIPU_API_KEY,
    baseURL = process.env.ZHIPU_BASE_URL,
    temperature = 0.7,
    timeout = 5 * 60 * 1000,
  } = config;
  return new ChatOpenAI({
    model,
    apiKey,
    configuration: {
      baseURL,
    },
    temperature,
    timeout,
  });
};

export const llm = createLLM();
