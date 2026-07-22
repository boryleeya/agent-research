import { llm } from "./model/index.js";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableParallel,
  RunnablePassthrough,
  RunnableLambda,
} from "@langchain/core/runnables";
import { createPrompt } from "./prompts/index.js";

const parser = new StringOutputParser();

const searchDocs = RunnableLambda.from((query) => {
  return [`文档结果:${query}的相关内容......`];
});

const searchWeb =  RunnableLambda.from((query) => {
  return [`网页结果：关于${query}的最新信息.....`];
});
const searchDb = RunnableLambda.from((query) => {
  return [`数据库结果:${query}的结构化数据......`];
});

const multiSourceChain = RunnableParallel.from({
  docs: searchDocs,
  web: searchWeb,
  db: searchDb,
});
const chain = RunnablePassthrough.assign({
  source: async (input) => {
    return multiSourceChain.invoke(input.question);
  },
})
  .pipe((input) => {
    return {
      question: input.question,
      context: [
        ...input.source.docs,
        ...input.source.web,
        ...input.source.db,
      ].join("\n"),
    };
  })
  .pipe(
    createPrompt(`
    基于以下信息回答用户问题。
    参考信息：
    {context}
    用户问题：
    {question}
    请给出准确的全面的回答：
    `)
  )
  .pipe(llm)
  .pipe(parser);

const res = await chain.invoke({ question: "langchain.js是什么" });
console.log(res);
