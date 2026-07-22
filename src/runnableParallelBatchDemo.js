import { llm } from "./model/index.js";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableLambda,
  RunnableParallel,
  RunnablePassthrough,
} from "@langchain/core/runnables";
import { createPrompt } from "./prompts/index.js";

const parser = new StringOutputParser();

const summaryPrompt = createPrompt(`
    用2-3句话概括以下文本的核心内容:\n\n{text}
    `);
const summaryChain = summaryPrompt.pipe(llm).pipe(parser);

const keywordsPrompt = createPrompt(
  `从以下文本中提取5个最重要的关键词，以数组格式返回:\n\n{text}`
);
const keywordsChain = keywordsPrompt.pipe(llm).pipe(parser);

const sentimentPrompt = createPrompt(`
    分析以下文本的情感倾向，仅输出纯JSON，禁止使用markdown代码块、解释文字、多余换行。
    输出结构：
    {{"sentiment": "positive" | "negative" | "neutral", "confidence": 0-1, "reason": "简单说明"}}

    文本：{text}
    `);
const sentimentChain = sentimentPrompt.pipe(llm).pipe(parser);

const parallelChain = RunnableParallel.from({
  summary: summaryChain,
  keywords: keywordsChain,
  sentiment: sentimentChain,
});
const chain = RunnablePassthrough.assign({
  source: async (input) => {
    return parallelChain.invoke(input);
  },
});
const res = await chain.invoke({
  text: `苹果公司今天发布了全新的 Vision Pro 2 头显设备。新设备在重量上比前代
    减轻了 40%，同时将电池续航提升到了 4 小时。不过高达 4999 美元的售价
    仍然让许多消费者望而却步。分析师认为，苹果需要在价格策略上做出调整
    才能真正推动空间计算的大众化。`,
});

console.log(res.source);
