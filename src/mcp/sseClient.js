import { MultiServerMCPClient } from '@langchain/mcp-adapters'
import { llm } from '../model/index.js'
import 'dotenv/config'
import { createAgent } from 'langchain';

// const client = new MultiServerMCPClient({
//     'amap-maps': {
//         command: "npx",
//         args: [
//             "-y",
//             "@amap/amap-maps-mcp-server"
//         ],
//         "env": {
//             AMAP_MAPS_API_KEY: process.env.AMAP_API_KEY
//         }
//     }
// });
const client = new MultiServerMCPClient({
    'amap-maps': {
        transport: "http",
        url: `https://mcp.amap.com/mcp?key=${process.env.AMAP_API_KEY}`,
        "env": {
            AMAP_MAPS_API_KEY: process.env.AMAP_API_KEY
        }
    }
});
const tools = await client.getTools();
console.log('工具:', tools.map(el => ({ name: el.name, description: el.description })))

const agent = createAgent({
    model: llm,
    tools
})

const res = await agent.invoke({
    messages: [{ role: 'human', content: `杭州未来3天的旅行攻略。帮我制作旅行攻略，考虑出行时间和路线，以及天气状况路线规划。`}]
})
console.log(res.messages.pop().content)


