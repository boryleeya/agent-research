import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { llm } from "../model/index.js";
import { trimMessages } from "langchain";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";

class MultiUserMemorySystem {
  constructor() {
    this.llm = llm;
    this.historyStore = new Map();
    this.sessionManager = new Map();
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "你是一个智能助手，请根据对话历史提供个性化帮助。如果用户问关于其他用户的信息,告诉他无法告知其他用户的数据。",
      ],
      new MessagesPlaceholder("history"),
      ["human", "{input}"],
    ]);
    const chain = prompt.pipe(this.llm);
    this.bot = new RunnableWithMessageHistory({
      runnable: chain,
      getMessageHistory: async (sessionId) => {
        return this.getOrCreateHistory(sessionId);
      },
      inputMessagesKey: "input",
      historyMessagesKey: "history",
    });
  }
  createSession(userId, topic) {
    const sessionId = `${userId}:${topic || 'default'}:${Date.now()}`
    this.sessionManager.set(sessionId, {
        userId,
        createAt: Date.now(),
        lastActive: Date.now()
    })
  }
  getOrCreateHistory(sessionId) {
    if (!this.historyStore.has(sessionId)) {
        this.historyStore.set(sessionId, new InMemoryChatMessageHistory())
    }
    const session = this.historyStore.get(sessionId)
    if(session) {
        session.lastActive = Date.now()
    }
    return this.historyStore.get(sessionId)
  }
  async chat(sessionId, input) {
    const session = this.sessionManager.get(sessionId)
    if (!session) return
    const config = { configurable: { sessionId }} 
    const response = await this.bot.invoke({input }, config)
    return response.content
  }
  getUserSessions(userId) {
    return Array.from(this.sessionManager.entries()).map(el => el.userId).filter(el => el === userId )
  }
  async deleteSession(sessionId) {
    const history = this.historyStore.get(sessionId)
    if (history) {
        await history.clear()
    }
    this.historyStore.delete(sessionId)
    this.sessionManager.delete(sessionId)
  }
  cleanupInactive(maxIdleMs) {
    const cutoff = Date.now() - maxIdleMs
    let cleaned = 0
    for(const [id, info] of this.sessionManager) {
        if (info.lastActive < cutoff) {
            this.historyStore.delete(id)
            this.sessionManager.delete(id)
            cleaned++
        }
    }
    return cleaned;
  }
  getStats() {
    return {
        totalSessions: this.sessionManager.size,
        totalHistories: this.historyStore.size,
        uniqueUsers: new Set(Array.from(this.sessionManager.values()).map(s => s.userId)).size
    }
  }
}
