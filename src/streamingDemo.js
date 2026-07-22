import { llm } from "./model/index.js";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createPrompt } from "./prompts/index.js";
const parser = new StringOutputParser()
const prompt = createPrompt(`你是一个AI助手,请根据用户输入回答，用户输入：{concept}`)
const chain = prompt.pipe(llm).pipe(parser)
const eventStream = await chain.streamEvents(
    { concept: 'langchain.js是什么'},
    { version: 'v2'}
)
for await (const event of eventStream) {
    console.log(event)
    const eventType =  event.event
    if (eventType === 'on_chain_stream') {
        process.stdout.write(event.data.chunk)
    }else  if (eventType === 'on_llm_stream') {
        process.stdout.write(event.data.chunk)
    }
}