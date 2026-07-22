import { llm } from "./model/index.js";
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
import { trimMessages } from "langchain";

const sessionId = uuidv4();

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个有丰富经验的前端开发专家。"],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);

const trimPrompt = RunnableLambda.from(async (promptValue) => {
  const promptMessages = await promptValue.toChatMessages();
  return trimMessages(promptMessages, {
    maxTokens: 128 * 1000,
    strategy: "last",
    tokenCounter: llm,
    includeSystem: true,
    startOn: "human",
  });
});
const chain = prompt.pipe(trimPrompt).pipe(llm);

const messageStore = {};

const getMessageHistory = (sessionId) => {
  if (!messageStore[sessionId]) {
    messageStore[sessionId] = new InMemoryChatMessageHistory();
  }
  return messageStore[sessionId];
};

const config = { configurable: { sessionId } };

const chatMessagesHistoryChain = new RunnableWithMessageHistory({
  runnable: chain,
  getMessageHistory,
  inputMessagesKey: "input",
  historyMessagesKey: "history",
  returnMessages: true
});
const conversations = [
  "你好，我叫张三，我是一名前端工程师",
  "我主要用react和typescript开发",
  "最近在学习Langchain.js框架，想做一个AI助手",
  "帮我总结下我的技术栈",
  "我之前说我叫什么名字？",
];
for (let input of conversations) {
  console.log(`\n用户:${input}`);
  const res = await chatMessagesHistoryChain.invoke({ input }, config);
  console.log(`\n助手：${res.content}`);
}
const history = await getMessageHistory(sessionId) 
const answerMessages = await history.getMessages()
// console.log(`\n 存储的消息数是：${answerMessages.length} \n\n${JSON.stringify(answerMessages, null, 2)}`)


