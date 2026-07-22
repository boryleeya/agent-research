import { llm } from "./model/index.js";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createPrompt } from "./prompts/index.js";
import { RunnableSequence } from "@langchain/core/runnables";

const parse = new StringOutputParser();

const detectLangPrompt = createPrompt(
  `检测以下文本的语言，只返回语言名称(如 english，中文，日语):\n{text}`
);
const detectLang = detectLangPrompt.pipe(llm).pipe(parse);

const translatePrompt = createPrompt(
  `将以下{sourceLang}文本翻译成{targetLang},保持原文风格:\n{text}`
);
const translate = translatePrompt.pipe(llm).pipe(parse);

const qualityCheckPrompt = createPrompt(`
        对比原文和译文，给出翻译质量评分(1-10)和改进建议。
        原文{sourceLang}:{text}
        译文{targetLang}: {translation}
        只返回JSON格式：{{"score":number,"suggestions": string[]}}
        `);
const qualityCheck = qualityCheckPrompt
  .pipe(llm)
  .pipe(parse)
  .pipe((text) => JSON.parse(text));

const chain = RunnableSequence.from([
  async (input) => {
    const sourceLang = await detectLang.invoke({ text: input.text });
    return { ...input, sourceLang: sourceLang.trim() };
  },
  async input => {
    const translation = await translate.invoke(input)
    return { ...input, translation}
  },
  async input => {
    const quality = await qualityCheck.invoke(input)
    return {
        originalText: input.text,
        sourceLang: input.sourceLang,
        targetLang: input.targetLang,
        translation: input.translation,
        quality
    }
  }
]);
const res = await chain.invoke({
    text: 'the quick brown fox jumps over the lazy dog.',
    targetLang: '中文'
})
console.log(res)
