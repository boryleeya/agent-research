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
    const sessionId = `${userId}:${topic || "default"}:${Date.now()}`;
    this.sessionManager.set(sessionId, {
      userId,
      createAt: Date.now(),
      lastActive: Date.now(),
    });
    return sessionId;
  }
  getOrCreateHistory(sessionId) {
    if (!this.historyStore.has(sessionId)) {
      this.historyStore.set(sessionId, new InMemoryChatMessageHistory());
    }
    const session = this.historyStore.get(sessionId);
    if (session) {
      session.lastActive = Date.now();
    }
    return this.historyStore.get(sessionId);
  }
  async chat(sessionId, input) {
    const session = this.sessionManager.get(sessionId);
    if (!session) return;
    const config = { configurable: { sessionId } };
    const response = await this.bot.invoke({ input }, config);
    return response.content;
  }
  getUserSessions(userId) {
    return Array.from(this.sessionManager.entries())
      .filter(([_, info]) => info.userId === userId)
      .map(([id]) => id);
  }
  async deleteSession(sessionId) {
    const history = this.historyStore.get(sessionId);
    if (history) {
      await history.clear();
    }
    this.historyStore.delete(sessionId);
    this.sessionManager.delete(sessionId);
  }
  cleanupInactive(maxIdleMs) {
    const cutoff = Date.now() - maxIdleMs;
    let cleaned = 0;
    for (const [id, info] of this.sessionManager) {
      if (info.lastActive < cutoff) {
        this.historyStore.delete(id);
        this.sessionManager.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
  getStats() {
    return {
      totalSessions: this.sessionManager.size,
      totalHistories: this.historyStore.size,
      uniqueUsers: new Set(
        Array.from(this.sessionManager.values()).map((s) => s.userId)
      ).size,
    };
  }
}

const run = async () => {
  const system = new MultiUserMemorySystem();

  const sessionA = system.createSession("alice", "tech-consult");
  console.log("alice的会话:", sessionA);

  const sessionB = system.createSession("bob", "general");
  console.log("bob的会话:", sessionB);

  console.log("\n------alice的对话------");
  let reply = await system.chat(sessionA, "我叫alice，是ios开发者");
  console.log("助手：", reply);

  reply = await system.chat(sessionA, "我主要用swift和swiftUI");
  console.log("助手：", reply);

  console.log("\n------bob的对话------");
  reply = await system.chat(sessionB, "我叫bob，是产品经理");
  console.log("助手：", reply);

  reply = await system.chat(sessionB, "你知道其他用户是做什么的吗？");
  console.log("助手：", reply);

  console.log("\n------alice继续对话------");
  reply = await system.chat(sessionA, "帮我总结一下我的技术背景");
  console.log("助手：", reply);


  console.log(`\n 系统统计：`, system.getStats())

  const sessionA2 = system.createSession('alice', 'career')
  reply = await system.chat(sessionA2, '你好，我想聊聊职业规划')
  console.log("\alice新会话：", reply);

  console.log(`\nalice的所有会话：`, system.getUserSessions('alice'))
};

run().catch(console.error)
