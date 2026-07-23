import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { Document, HumanMessage } from "langchain";
import  { llm, createLLM } from './model/index.js'
import { HumanMessage } from "langchain";
import { version } from "react";

const embeddings = new OpenAIEmbeddings({
    model: 'bge-m3',
    configuration: {
        baseURL: 'http://localhost:11434/v1'
    }
})

const vectorStore = new MemoryVectorStore(embeddings)

const conversationToDocument = (humanMsg, aiMsg, metadata = {}) => {
    return new Document({
        pageContent: `用户:${humanMsg}\n助手:${aiMsg}`,
        metadata: {
            ...metadata,
            timestamp: Date.now(),
            type: 'conversation'
        }
    })
}
// 写入
const doc = conversationToDocument('我在学习lanchain.js', 'langchain.js是一个很好的AI开发框架')
await vectorStore.addDocuments([doc])

const summaryAndStore = async (humanMsg, aiMsg, vectorStore) => {
    const res = await llm.invoke([new HumanMessage(`
        从以下对话中提取值得长期记住的关键信息。如果没有值得记住的，输出“无”。
        用户：${humanMsg}
        助手：${aiMsg}
        关键信息:\n
        `)])
    const summaryText = res.content.trim()
    if (summaryText !== '无') {
        const doc = new Document({
            pageContent: summaryText,
            metadata: { timestamp: Date.noew(), source: 'conversation'}
        })
        await vectorStore.addDocuments([doc])
    }
}

const retriever = vectorStore.asRetriever({
     k: 5,
    searchType: 'similarity',
    filter: {
        userId: "user-0001",
        timestamp: { $gte: Date.now() - 7 * 24 * 60 * 60 * 1000 }
    }
})
const relevantMemories = await retriever.invoke('推荐技术书籍')

const mmrRetriever = vectorStore.asRetriever({
    k: 5,
    searchType: 'mmr',
    searchKwargs: {
        fetchK: 20,
        lambda: 0.7
    }
})