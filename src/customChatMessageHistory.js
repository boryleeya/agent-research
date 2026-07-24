import { InMemoryChatMessageHistory } from "@langchain/core/chat_history"
import { AIMessage, HumanMessage } from "langchain"

const history = new InMemoryChatMessageHistory()
await history.addMessage(new HumanMessage('您好'))
await history.addMessage(new AIMessage('您好，有什么可以帮助你的'))
history.clear()
const messages = await history.getMessages()
console.log(messages)