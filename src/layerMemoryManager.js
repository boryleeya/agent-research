// 综合策略： 短期记忆 + 长期记忆
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { llm } from "./model/index.js";
import { Document } from "langchain";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

const embeddings = new OpenAIEmbeddings({
  model: "",
  configurable: {
    baseURL: "",
  },
});
const vectorStore = new MemoryVectorStore(embeddings);

class LayeredMemoryManager {
  constructor() {
    this.recentMessages = [];
    this.maxRecentMessages = 10; // 5轮
  }
  async addToBuffer(human, ai) {
    this.recentMesages.push(human);
    this.recentMesages.push(ai);

    while (this.recentMessages.length > this.maxRecentMessages) {
      const oldHuman = this.recentMessages.shift();
      const oldAI = this.recentMessages.shift();
      await this.saveToLongTermMemory(oldHuman, oldAI);
    }
  }
  async saveToLongTermMemory(human, ai) {
    const doc = new Document({
      pageContent: `用户:${human}\n助手:${ai}`,
      metadata: { timestamp: Date.now() },
    });
    await vectorStore.addDocuments([doc]);
  }
  async getContext(currentInput) {
    const messages = [];
    const retriever = vectorStore.asRetriever({ k: 3 });
    try {
      const relevantDocs = await retriever.invoke(currentInput);
      if (relevantDocs.length) {
        const longTermContext = relevantDocs
          .map((doc) => doc.pageContent)
          .join("\n---\n");
        messages.push(longTermContext);
      }
    } catch (error) {}
    messages.push(...this.recentMesages);
    return messages;
  }
}
const run = async () => {
  const memory = new LayeredMemoryManager();
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你是一个智能助手，能够记住用户的信息并提供个性化帮助"],
    new MessagesPlaceholder("context"),
    ["human", "{input}"],
  ]);
  const chain = prompt.pipe(llm);

  const conversations = [
    "你好，我叫张三，我是一名前端工程师",
    "我主要用react和typescript开发",
    "最近在学习Langchain.js框架，想做一个AI助手",
    "帮我总结下我的技术栈",
    "我之前说我叫什么名字？",
  ];
  for(const input of conversations) {
    console.log(`\n用户：${input}`)
    const context = await memory.getContext(input)
    const response = await chain.invoke({ context, input })
    const content = response.content
    console.log(`助手：${content}`)
    memory.addToBuffer(input, content)
  }
};
run().catch(() => {
    console.log('失败')
})
