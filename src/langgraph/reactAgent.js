import { tool } from "@langchain/core/tools";
import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { llm } from "../model/index.js";
import { z } from "zod";
import * as fs from "node:fs/promises";
import { HumanMessage } from "langchain";

const searchTool = tool(
  async ({ query }) => `搜索结果:关于“${query}”的最新信息.....`,
  {
    name: "search",
    description: "搜索互联网信息",
    schema: z.object({
      query: z.string(),
    }),
  }
);
const calcTool = tool(
  async ({ expression }) => {
    const result = Function(`"use strict";return ${expression}`)();
    return `${expression} = ${result}`;
  },
  {
    name: "calculator",
    description: "数学计算",
    schema: z.object({
      expression: z.string(),
    }),
  }
);

const tools = [searchTool, calcTool];
const llmWithTools = llm.bindTools(tools);

const agentNode = async (state) => {
  const res = await llmWithTools.invoke(state.messages);
  return { messages: [res] };
};

const shouldContinue = async (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls && lastMessage.tool_calls.length) {
    return "tools";
  }
  return END;
};

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

const app = graph.compile();

const res = await app.invoke({
  messages: [{ role: "user", content: "帮我搜索北京天气，然后计算32+15" }],
});
for (let msg of res.messages) {
  const role = msg._getType();
  console.log(`${role}: ${msg.content}`);
}
try {
  const drawableGraph = await app.getGraphAsync();
  console.log(drawableGraph.drawMermaid());
  const image = await drawableGraph.drawMermaidPng();
  const imageBuffer = new Uint8Array(await image.arrayBuffer());

  await fs.writeFile("./graph.png", imageBuffer);
} catch (error) {
  console.log("error:", error);
}

const stream1 = await app.stream(
  {
    messages: [new HumanMessage("langchain.js是什么")],
  },
  { streamMode: "messages" }
);

for await (let chunk of stream1) {
//   console.log("chunk:", chunk);
  for (const [nodeName, update] of Object.entries(chunk)) {
    console.log(`节点[${nodeName}]输出：${JSON.stringify(update, null, 2)}`);
  }
}
