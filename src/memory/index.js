import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import {
  RunnableLambda,
  RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { trimMessages } from "@langchain/core/messages";
import { llm } from "../model/index.js";
import { v4 as uuidv4 } from "uuid";

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `你是一个智能助手，请注意以下几点：1.记住用户告诉你的信息；2.如果用户问你之前的对话内容，据实回答；3.如果信息已被遗忘（超出记忆窗口）,诚实告知。`,
  ],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

const trimStep = RunnableLambda.from(async (promptValue) => {
  const messges = await promptValue.toChatMessages();
  const trimMessagesFunc = await trimMessages(messges, {
    maxTokens: 4000,
    strategy: "last",
    tokenCounter: llm,
    includeSystem: true,
    startOn: "human",
  });
  return trimMessagesFunc
});

const chain = prompt.pipe(trimStep).pipe(llm);

const messageStore = {};

const getMessageHistory = (sessionId) => {
  if (!messageStore[sessionId]) {
    messageStore[sessionId] = new InMemoryChatMessageHistory();
  }
  return messageStore[sessionId];
};

const withHistory = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "history",
});

const config = { configurable: { sessionId: uuidv4() } };
const res1 = await withHistory.invoke(
  { input: "我叫张三，在北京工作" },
  config
);
console.log(res1);
const res2 = await withHistory.invoke(
  { input: "我是谁?我在哪个城市?" },
  config
);
console.log(res2);
