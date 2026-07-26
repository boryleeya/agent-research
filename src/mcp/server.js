import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import 'dotenv/config'

const server = new Server(
    {
        name: "weather-server",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "getCityCode",
                description: "获取城市编码",
                inputSchema: {
                    type: "object",
                    properties: {
                        keywords: {
                            type: "string",
                            description: "城市名称",
                        },
                    },
                    required: ["keywords"]
                },
            },
            {
                name: "getCityWeather",
                description: "获取城市天气",
                inputSchema: {
                    type: "object",
                    properties: {
                        city: {
                            type: "string",
                            description: "城市编码",
                        },
                    },
                    required: ["city"]
                },
            },
        ],
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    console.log('CallToolRequestSchema:', JSON.stringify(request.params))
    switch (request.params.name) {
        case "getCityCode": {
            const { keywords } = request.params.arguments;
            console.log('keywords:', {
                key: process.env.AMAP_API_KEY,
                keywords
            })
            const res = await axios.get(`https://restapi.amap.com/v3/config/district?key=${process.env.AMAP_API_KEY}&keywords=${keywords}`)
            console.log('getCityCode:', res.data)
            const item = res.data.districts[0]
            const { districts, adcode } = item
            const subItem = districts.find(el => el.name.includes(keywords))
            return {
                content: [
                    {
                        type: "text",
                        text: (subItem && subItem.adcode) || adcode || '',
                    },
                ],
            };
        }
        case "getCityWeather": {
            const { city } = request.params.arguments;
            const res = await axios.get('https://restapi.amap.com/v3/weather/weatherInfo', {
                params: {
                    key: process.env.AMAP_API_KEY,
                    city,
                    extensions: 'base',
                    output: 'JSON'
                }
            })
            const resData = res.data.lives[0]
            const { province, weather, winddirection, temperature, humidity } = resData
            return {
                content: [
                    {
                        type: "text",
                        text: `${province}省${resData.city},天气：${weather}， 风向：${winddirection}， 湿度：${humidity}， 温度：${temperature}`,
                    },
                ],
            };
        }
        default:
            throw new Error(`Unknown tool: ${request.params.name}`);
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Math MCP server running on stdio");
}

main().catch(error => {
    console.log('1111:', error)
});