import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { llm } from '../model/index.js'
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import 'dotenv/config'
import axios from 'axios'
import { createAgent } from "langchain";

const client = new MultiServerMCPClient({
    weather: {
        transport: "stdio",
        command: "node",
        args: ["D:/agent-research/src/mcp/server.js"],
        "env": {
            apiKey: process.env.AMAP_API_KEY
        }
    }
});

const tools = await client.getTools();
// console.log('工具:', tools)
const agent = createAgent({
    model: llm,
    tools,
});

const weatherResponse = await agent.invoke({
    messages: [{ role: "human", content: "获取杭州天气？" }],
});
console.log('===weatherResponse===\n\n', weatherResponse.messages.pop().content)
