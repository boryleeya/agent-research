import { MongoDBChatMessageHistory } from '@langchain/mongodb'
import { llm } from "./model/index.js"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { MongoClient } from 'mongodb'
const sessionId = '0000'
const config = { configurable: { sessionId }}
const mongodbClient = new MongoClient('mongodb://localhost:27017')
await mongodbClient.connect()
const db = mongodbClient.db('chatbot')
const collection = db.collection('chat_histories')

const prompt = ChatPromptTemplate.fromMessages([
    ['system', '你是一个友好智能助手，请简洁回答用户问题'],
    new MessagesPlaceholder('history'),
    ['human', '{input}']
])

const chain = prompt.pipe(llm)

const getMessageHistory = async (sessionId) => {
    const history = new MongoDBChatMessageHistory({
        collection,
        sessionId
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