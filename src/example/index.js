import express from "express";
import cors from "cors";
import { llm } from "../model/index.js";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createPrompt } from "../prompts/index.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log(join(__dirname, "./index.html"));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, ".")));
app.use(cors());

const parser = new StringOutputParser();
const prompt = createPrompt(`请回答用户问题：{question}`);
const chain = prompt.pipe(llm).pipe(parser);

app.get("/index.html", function (req, res) {
  res.sendFile(join(__dirname, "./index.html"));
});

app.post("/api/stream", async (req, res) => {
  console.log(req.body);
  const { question } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const stream = await chain.stream({ question });
  for await (const chunk of stream) {
    process.stdout.write(chunk)
    res.write(`data:${JSON.stringify({ content: chunk })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

const server = app.listen(3000, () => {
  console.log("服务器启动再3000端口");
  const host = server.address().address;
  const port = server.address().port;

  console.log("应用实例，访问地址为 http://%s:%s", host, port);
});
