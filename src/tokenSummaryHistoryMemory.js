import { createLLM, llm } from "./model/index.js";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { v4 as uuidv4 } from "uuid";
import {
  RunnableLambda,
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { HumanMessage, trimMessages, SystemMessage } from "langchain";

// 当历史上下文的token大于某个值且会话经过n轮，保留最后m轮，然后排将n-m轮的会话进行摘要

// 关键阈值：history 历史消息总token超过该值才触发摘要
const MAX_HISTORY_TOKENS = 800;
// 整体消息兜底最大token
const MAX_FINAL_TOKENS = 2600;
// 压缩时保留最近几轮完整问答（一轮=人机两条）
const KEEP_RECENT_ROUNDS = 1;

const KEEP_MSG_COUNT = KEEP_RECENT_ROUNDS * 2;

// 生成摘要的大模型
const summaryllm = createLLM({ temperature: 0 });

const chatPrompt = ChatPromptTemplate.fromMessages([
  ["system", "你是友好的技术导师，结合历史摘要与近期对话回答用户问题。"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

const sessionId = uuidv4();
const historyStore = new Map();

const getMessageHistory = (sessionId) => {
  if (!historyStore.has(sessionId)) {
    historyStore.set(sessionId, new InMemoryChatMessageHistory());
  }
  return historyStore.get(sessionId);
};

const generateSummary = async (messages) => {
  const content = messages
    .map((m) => `${m._getType()}: ${m.content}`)
    .join("\n");
  const summaryPrompt = `精炼总结下面全部对话，保留用户背景、需求、学习计划等关键信息，200字以内：${content}`;
  const res = await summaryllm.invoke([new HumanMessage(summaryPrompt)]);
  return typeof res.content === "string"
    ? res.content
    : JSON.stringify(res.content);
};

const contextMiddleware = RunnableLambda.from(async (payload, options) => {
  const { input, history } = payload;
  let workingHistory = [...history];
  const { totalCount, countPerMessage } = await llm.getNumTokensFromMessages(
    workingHistory
  );
  const historyTokenCount = totalCount;
  console.log(
    `当前history token：${historyTokenCount}，阈值：${MAX_HISTORY_TOKENS}`, historyTokenCount > MAX_HISTORY_TOKENS
  );

  if (
    historyTokenCount > MAX_HISTORY_TOKENS &&
    workingHistory.length > KEEP_MSG_COUNT
  ) {
    console.log("history token超出阈值，执行摘要压缩");
    // 分割：前面旧消息压缩，后面保留完整对话
    const toCompressMsgs = workingHistory.slice(
      0,
      workingHistory.length - KEEP_MSG_COUNT
    );
    const recentMsgs = workingHistory.slice(-KEEP_MSG_COUNT);
    // 生成摘要
    const summaryText = await generateSummary(toCompressMsgs);
    console.log(`【历史对话摘要】${summaryText.trim()}`);

    if (summaryText.trim()) {
      workingHistory = [
        new SystemMessage(`【历史对话摘要】${summaryText.trim()}`),
        ...recentMsgs,
      ];
    } else {
      workingHistory = [...recentMsgs];
    }
  } else {
    console.log("history token未超限，直接使用原始对话");
  }
  // 拼装完整消息（系统提示+处理后的history+用户当前提问）
  const fullMessages = await chatPrompt.formatMessages({
    history: workingHistory,
    input,
  });
  // 全局token兜底裁剪，防止拼装后整体超限
  const trimmedMessages = await trimMessages(fullMessages, {
    maxTokens: MAX_FINAL_TOKENS,
    tokenCounter: llm,
    strategy: "first",
    keepFirstMessage: true,
  });
  const validMessages = trimmedMessages.filter((msg) => {
    const text =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    return text.trim() !== "";
  });
  return validMessages;
});

const baseChain = contextMiddleware.pipe(llm);

const chatChain = new RunnableWithMessageHistory({
  runnable: baseChain,
  getMessageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "history",
  returnMessages: true,
});

const questionList = [
  "我叫小明，25岁，在深圳做3年Java后端开发",
  "我想转型做AI应用开发，Python基础薄弱，Java很熟练",
  "我应该优先学习Python，还是直接使用TS+LangChain.js？",
  "如果选择TypeScript路线，大概多久可以独立开发小型AI项目？",
  "帮我完整总结我的个人背景和AI学习路线规划",
];
const config = { configurable: { sessionId } };

const run = async () => {
  for (const question of questionList) {
    console.log("\n==================== 用户提问 ====================");
    console.log("👤", question);
    const aiRes = await chatChain.invoke({ input: question }, config);
    console.log("🤖 AI回答：\n", aiRes.content);
  }
};

run().catch((e) => {
  console.error("运行异常完整报错：", e);
});
