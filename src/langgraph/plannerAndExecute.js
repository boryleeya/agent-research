import { llm } from "../model/index.js";
import { z } from 'zod'
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { END, StateGraph, Annotation, START, MemorySaver } from "@langchain/langgraph";
import {  StructuredOutputParser } from '@langchain/core/output_parsers'

const PlanExecuteState = Annotation.Root({
  // 用户原始输入
  input: Annotation(),

  // 执行计划：有序的步骤列表
 // 执行计划：有序的步骤列表
  plan: Annotation({
    reducer: (_, update) => update,  // 整体替换（Re-plan 时更新）
    default: () => [],
  }),

  // 已完成步骤及其结果
  completedSteps: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // 当前正在执行的步骤
  currentStep: Annotation({
    reducer: (_, update) => update,
    default: () => "",
  }),

  // 最终输出
  output: Annotation({
    reducer: (_, update) => update,
    default: () => "",
  }),

  // 消息历史（用于 Executor 的工具调用）
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

const plannerSchema = z.object({
    steps: z.array(z.string()).describe('按顺序排列的执行步骤列表,每个步骤是一句简洁的任务描述')
})
const plannerLLM = llm.withStructuredOutput(plannerSchema)

const plannerNode = async state => {
    const result = await plannerLLM.invoke([
        new SystemMessage(`
            你是一个任务规划专家。请将用户的任务分解为3—7个有序的执行步骤。
            每个步骤应该：
            1.足够具体，可以独立执行
            2.前后步骤有逻辑递进关系
            3.用一句话描述清楚要做什么
        不要包含“汇总”或“返回结果”这类步骤，最后一步应该是最终的分析或总结
                `),
                new HumanMessage(state.input)
    ])
    return {
        plan: result.steps,
        currentStep: result.steps[0]
    }
}
const webSearch = tool(
    async ({ query }) => {
        return `搜索"${query}"的结果，找到行业数据和分析报告`
    },
    {
        name: 'web_search',
        description: '搜索互联网获取信息',
        schema: z.object({
            query: z.string()
        })
    }
)

const analyzeTool  = tool(
    async ({ data, question }) => {
        return `基于数据${data}分析问题${question}的结论：数据呈现上升趋势，同比增长15%`
    },
    {
        name: 'analyze_data',
        description: '分析数据并得出结论',
        schema: z.object({
            data: z.string().describe('待分析的数据'),
            question: z.string().describe('分析问题')
        })
    }
)
const tools = [webSearch, analyzeTool]
const executorAgent = createReactAgent({
    llm,
    tools
})
const executoreNode = async state => {
    const context = state.completedSteps.map((s, i) => `步骤${i+1}:${s.step}\n结果:${s.result}`).join('\n\n')
    const executorInput = `
        你正在执行一个多步骤任务。
        原始任务：${state.input}
        已完成的步骤\n${context}\n
        当前需要执行的步骤:${state.currentStep}

        请执行当前步骤，使用工具获取所需信息。执行完成后，给出该步骤的结果总结
    `
    const result = await executorAgent.invoke({
        messages: [new HumanMessage(executorInput)]
    })
    const lastMesage = result.messages[result.messages.length - 1]
    const stepResult = typeof lastMesage.content === 'string' ? lastMesage.content : JSON.stringify(lastMesage.content)
    return {
        completedSteps: [{ step: state.currentStep, result: stepResult}]
    }
}

const replanSchema = z.object({
    action: z.enum(['continue', 'replan', 'finish']).describe('下一步行动'),
    updatedPlan: z.array(z.string()).optional().describe('如果replan，提供更新后的剩余步骤'),
    finalOutput: z.string().optional().describe('如果finish,提供最终输出')
})
const replannerSchemaLLM = llm.withStructuredOutput(replanSchema)

const replannerNode = async state => {
    const completedSummary = state.completedSteps.map((s,t) => `步骤${t+1}:${s.step}\n结果:${s.result}`).join('\n\n')
    const remainningSteps = state.plan.slice(state.completedSteps.length)
    const result = await replannerSchemaLLM.invoke([
         new SystemMessage(`
            你是一个任务规划评估专家，根据已完成步骤的结果，决定：
            1. 'continue' - 按原计划继续执行下一步
            2. 'replan' - 根据已有信息调整剩余计划
            3. 'finish' - 已收集足够信息，生成最终输出
            `),
        new HumanMessage(`
                原始任务：${state.input}
                已完成步骤： ${completedSummary}
                原计划中剩余步骤：${remainningSteps.map((s, i) => `${i+1}. ${s}`).join('\n\n')}
                请评估是否需要调整计划
                `)
    ])
    if(result.action === 'finish') {
        return { output: result.finalOutput || '任务完成'}
    }
    if(result.action === 'replan' && result.updatedPlan) {
        const completedStepNames = state.completedSteps.map(s => s.step)
        return {
            plan: [...completedStepNames, ...result.updatedPlan],
            currentStep: result.updatedPlan[0]
        }
    }
    const nextIndex = state.completedSteps.length
    return {
        currentStep: state.plan[nextIndex] || ''
    }

}

const routeAfterReplan = state => {
    if (state.output) return END
    if(state.currentStep) return 'executor'
    return END
}

const graph = new StateGraph(PlanExecuteState)
                .addNode('planner', plannerNode)
                .addNode('executor', executoreNode)
                .addNode('replanner', replannerNode)
                .addEdge(START, 'planner')
                .addEdge('planner', 'executor')
                .addEdge('executor', 'replanner')
                .addConditionalEdges('replanner', routeAfterReplan)

const app = graph.compile( { checkpointer: new MemorySaver()})
const config = { configurable: { thread_id: '9999'}};
(async function main() {
  try {
    const result = await app.invoke(
      {
        input: "分析2025年中国新能源汽车市场的竞争格局，包括主要玩家的市场份额和技术路线对比"
      },
      config
    );
    console.log("任务执行完成，完整状态：\\n", JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("流程执行异常：", err);
  }
})();