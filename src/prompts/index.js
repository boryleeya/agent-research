import { ChatPromptTemplate } from "@langchain/core/prompts";

export const createPrompt = (message) => {
  return ChatPromptTemplate.fromTemplate(message);
};
