import { StringOutputParser } from "@langchain/core/output_parsers";
import { llm } from "./model/index.js";
import {
  RunnableBranch,
  RunnableSequence,
  RunnablePassthrough,
  RunnableLambda,
} from "@langchain/core/runnables";
import { createPrompt } from "./prompts/index.js";

const parser = new StringOutputParser();

const classifyIntentPrompt = createPrompt(
  `请根据以下用户消息分类为以下意图之一： question、complaint、feedback、other,只返回用户意图名称。不要其他内容。

  用户消息：{message}`
);
const classifyIntent = classifyIntentPrompt.pipe(llm).pipe(parser);

const questionPrompt = createPrompt(
  `用户提出了一个问题:\n{message}，请专业、详细地回答`
);
const questionChain = questionPrompt.pipe(llm).pipe(parser);

const compaintPrompt = createPrompt(
  `用户提出了投诉:\n{message}，请先表达歉意和理解，然后提出解决方案`
);
const compaintChain = compaintPrompt.pipe(llm).pipe(parser);

const feedbackPrompt = createPrompt(
  `用户提供了反馈:\n{message}，请表达感谢并说明我们会如何利用这个反馈`
);
const feedbackChain = feedbackPrompt.pipe(llm).pipe(parser);

const defaultPrompt = createPrompt(`请友好的回应用户的消息:\n{message}`);
const defaultChain = defaultPrompt.pipe(llm).pipe(parser);

const routeChain = RunnableSequence.from([
  RunnablePassthrough.assign({
    intent: async (input) => {
      return classifyIntent.invoke({ message: input.message });
    },
  }),
  RunnableBranch.from([
    [
      (input) => {
        console.log("=========", input);
        return input.intent === "question";
      },
      questionChain,
    ],
    [(input) => input.intent === "complaint", compaintChain],
    [(input) => input.intent === "feedback", feedbackChain],
    defaultChain,
  ]),
]);
const res = await Promise.all([
  routeChain.invoke({ message: "你们的API相应时间为什么这么慢" }),
  routeChain.invoke({ message: "Langchain支持哪些向量数据库" }),
  routeChain.invoke({ message: "建议你们增加对Milvus的原生支持" }),
]);
console.log(res)
