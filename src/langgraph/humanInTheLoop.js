import {
  StateGraph,
  START,
  END,
  MessagesAnnotation,
  interrupt,
  MemorySaver,
  Command,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { llm } from "../model/index.js";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

const sendEmailTool = tool(
  async ({ to, subject, body }) => {
    return `邮件已发送${to}, 主题：${subject},内容：${body}`;
  },
  {
    name: "send_mail",
    description: "发送电子邮件",
    schema: z.object({
      to: z.string().describe("收件人邮箱"),
      subject: z.string().describe("邮件主题"),
      body: z.string().describe("邮件正文"),
    }),
  }
);
const searchTool = tool(async ({ query }) => `搜索结果:${query}的相关信息`, {
  name: "search",
  description: "搜索信息(安全操作，无需审批)",
  schema: z.object({
    query: z.string(),
  }),
});
const tools = [sendEmailTool, searchTool];

const SENSITIVE_TOOLS = new Set(["send_mail"]);

const llmWithTools = llm.bindTools(tools);

const agentNode = async (state) => {
  const response = await llmWithTools.invoke(state.messages);
  return { messages: [response] };
};

const routerAfterAgent = (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    !lastMessage ||
    !lastMessage.tool_calls ||
    !lastMessage.tool_calls.length
  ) {
    return END;
  }
  const hasSensitive = lastMessage.tool_calls.some((tool) =>
    SENSITIVE_TOOLS.has(tool.name)
  );
  return hasSensitive ? "humanApproval" : "tools";
};

const humanApprovalNode = async (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage && lastMessage.tool_calls && lastMessage.tool_calls.length) {
    const sensitiveCall = lastMessage.tool_calls.find((tool) =>
      SENSITIVE_TOOLS.has(tool.name)
    );
    if (sensitiveCall) {
      const decision = interrupt({
        message: "以下操作需要您的审批:",
        tool: sensitiveCall.name,
        args: sensitiveCall.args,
        options: ["approve", "reject", "modify"],
      });
      if (decision.action === "reject") {
        return {
          messages: [
            new AIMessage(`操作已取消。原因:${decision.reason || "用户拒绝"}`),
          ],
          // Command 指定流程结束
          __next__: END,
        };
      }
    }
  }
  return {};
};

const graph = new StateGraph(MessagesAnnotation)
  .addNode("agent", agentNode)
  .addNode("humanApproval", humanApprovalNode)
  .addNode("tools", new ToolNode(tools))
  .addEdge(START, "agent")
  .addConditionalEdges("agent", routerAfterAgent)
  .addEdge('humanApproval', "tools")
  .addEdge("tools", "agent");

const checkpointer = new MemorySaver();
const app = graph.compile({ checkpointer });

const config = { configurable: { thread_id: "1111" } };
let res = await app.invoke(
  {
    messages: [
      new HumanMessage("帮我给1143467721@qq.com发一封邮件,主题是会议通知,邮件正文: 明天放假"),
    ],
  },
  config
);

const state = await app.getState(config);
console.log("下一个节点：", state.next);
console.log("中断信息:", state.tasks);

console.log("\n-------人工审批------");
res = await app.invoke(
  new Command({
    resume: { action: "reject" },
  }),
  config
);

const lastMsg = res.messages[res.messages.length - 1];
console.log("最终结果:", lastMsg.content);
