import { SystemMessage, trimMessages } from "langchain";
import { llm, createLLM } from "./model/index.js";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  RunnableLambda,
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { v4 as uuidv4 } from "uuid";

const summaryLlm = createLLM({ temperature: 0 });

const sessionId = uuidv4();

// 会话存储（唯一数据源）
const historyStore = new Map();
function getMessageHistory(sessionId) {
  if (!historyStore.has(sessionId)) {
    historyStore.set(sessionId, new InMemoryChatMessageHistory());
  }
  return historyStore.get(sessionId);
}

// 对话Prompt
const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", "你是友好的技术导师，结合历史摘要与近期对话回答。"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

// 摘要生成
async function buildSummary(messages) {
  const content = messages
    .map((m) => `${m._getType()}: ${m.content}`)
    .join("\n");
  const sumPrompt = `将以下对话精炼总结，保留关键信息，200字以内：
${content}`;
  const res = await summaryLlm.invoke([new SystemMessage(sumPrompt)]);
  return res.content;
}

/**
 * Runnable中间件
 * @param payload { input:string, history:BaseMessage[] }
 * @param options runnable配置，可读取sessionId
 */
const contextMiddleware = RunnableLambda.from(async (payload) => {
  const { input, history } = payload;
  const keepRecentCount = 4; // 保留最近4条完整消息（2轮问答）

  let workingHistory = [...history];
  // 需要压缩
  if (workingHistory.length > keepRecentCount) {
    const toSummary = workingHistory.slice(
      0,
      workingHistory.length - keepRecentCount
    );
    const recent = workingHistory.slice(-keepRecentCount);
    const summaryText = await buildSummary(toSummary);
    workingHistory = [
      new SystemMessage(`【历史对话摘要】：${summaryText}`),
      ...recent,
    ];
  }

  // 渲染完整消息
  let fullMessages = await chatPrompt.formatMessages({
    history: workingHistory,
    input,
  });

  // trim兜底
  const trimmed = await trimMessages(fullMessages, {
    maxTokens: 2600,
    tokenCounter: (msgs) => llm.getNumTokens(msgs),
    strategy: "first",
    keepFirstMessage: true,
  });
  return trimmed;
});

// 基础链路
const baseChain = contextMiddleware.pipe(llm);

// 包装会话管理
const chatChain = new RunnableWithMessageHistory({
  runnable: baseChain,
  getMessageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "history",
  returnMessages: true, // 必须开启，透传history给中间件
});

// 测试
async function run() {
  const sessionId = "test_001";
  const qs = [
    "我叫小明，25岁，深圳Java后端3年",
    "想转型AI开发，Python弱，Java熟练",
    "选Python还是TypeScript路线？",
    "走TS+LangChain上手周期多久？",
    "帮我总结我的情况和学习路线",
  ];

  for (const q of qs) {
    console.log("\n👤 用户：", q);
    const aiMsg = await chatChain.invoke(
      { input: q },
      { configurable: { sessionId } }
    );
    console.log("🤖 AI：", aiMsg.content.slice(0, 200));
  }
}

run().catch((err) => {
  console.error("运行报错：", err);
});
