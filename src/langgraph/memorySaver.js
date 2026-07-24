import {
  MemorySaver,
  StateGraph,
  StateSchema,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { llm } from "../model/index.js";

const callModel = async (state) => {
  const response = await llm.invoke(state.messages);
  return { messages: [response] };
};

const checkpointer = new MemorySaver();
const workflow = new StateGraph(MessagesAnnotation);
workflow.addNode("agent", callModel);
workflow.addEdge("__start__", "agent");
const graph = workflow.compile({ checkpointer });

const threadA = { configurable: { thread_id: "1111" } };
const res1 = await graph.invoke(
  {
    messages: [{ role: "human", content: "我是张三" }],
  },
  threadA
);
console.log('--111----',res1.messages.pop())
const res2= await graph.invoke(
  {
    messages: [{ role: "human", content: "我是前端开发者" }],
  },
  threadA
);
console.log('---222---',res2.messages.pop())
// const threadB = { configurable: { thread_id: "111" } };
const res3 = await graph.invoke(
  {
    messages: [{ role: "human", content: "我的技术栈时vue、react、node、uniapp" }],
  },
  threadA
);
console.log('-333-----',res3.messages.pop())
// const threadB = { configurable: { thread_id: "111" } };
const res4 = await graph.invoke(
  {
    messages: [{ role: "human", content: "我现在正在学习langgraph" }],
  },
  threadA
);
console.log('---444---',res4.messages.pop())

const checkponits = []
for await (const cp of graph.getStateHistory(threadA)) {
    checkponits.push(cp)
}
const targetCheckpoint = checkponits[2]
const historyState = await graph.getState({
    configurable: {
        thread_id: '1111',
        checkpoint_id: targetCheckpoint.config.configurable.checkpoint_id
    }
})

console.log(`历史状态:`, historyState)
