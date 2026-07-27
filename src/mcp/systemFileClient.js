import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import path from "path";
import { fileURLToPath } from "url";
import { createAgent, HumanMessage } from 'langchain'
import { llm } from "../model/index.js";

// 固定允许访问的根目录，禁止向上跳转
const ALLOW_WORKSPACE = "C:\\Users\\Administrator\\Desktop\\AI\\agent-research\\src";
// 在允许目录内自建临时文件夹，避开系统/tmp权限拦截
const mcpTempDir = path.join(ALLOW_WORKSPACE, ".mcp_local_tmp");

// 封装异步函数，解决顶层await报错
async function runMcp() {
  const client = new MultiServerMCPClient({
     filesystem: {
      transport: "stdio",
      // 直接调用全局安装的命令，无npx
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", ALLOW_WORKSPACE],
      cwd: ALLOW_WORKSPACE,
      env: {
        DEBUG: "mcp:*",
        TMPDIR: mcpTempDir
      },
    },
  });

  try {
    const tools = await client.getTools();
    const agent = createAgent({
        model: llm,
        tools
    })
    const res = await agent.invoke({
        messages: [new HumanMessage(`请在.mcp_local_tmp目录下创建一个1.txt文件`)]
    })
  } catch (err) {
    console.error("MCP连接失败完整日志：", err);
    // 释放子进程资源
    await client.close();
  }
}

// 执行入口
runMcp();
