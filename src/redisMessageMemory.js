import { RedisChatMessageHistory } from "@langchain/redis";
import { llm } from "./model/index.js"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { Redis } from 'ioredis'

const sessionId = '0000'
const config = { configurable: { sessionId }}
const redisClient = new Redis({
    host: '127.0.0.1',
    port: 6379,
    password: '',
    db: 0
})

const prompt = ChatPromptTemplate.fromMessages([
    ['system', '你是一个友好智能助手，请简洁回答用户问题'],
    new MessagesPlaceholder('history'),
    ['human', '{input}']
])

const chain = prompt.pipe(llm)

const getMessageHistory = async (sessionId) => {
    const history = new RedisChatMessageHistory({
        client: redisClient,
        sessionId,
        sessionTTL: 7 * 24 * 3600,
        keyPrefix: 'chat:runnable'
    })
    return history
}

const  chatChain = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory,
    inputMessagesKey: 'input',
    historyMessagesKey: 'history'
})
const res = await chatChain.invoke({ input: '你是谁?'}, config)