import { StructuredTool } from '@langchain/core/tools'
import { z } from 'zod'

const schema = z.object({
            city: z.string().describe('城市名称， 如： 北京、上海'),
            unit: z.enum(['celsius', 'fahrenheit']).optional().default('celsius').describe('默认单位，默认摄氏度')
        })

class WeatherTool extends StructuredTool {
    constructor(options) {
        const { name, description } = options
        this.name = name
        this.description = description
        this.schema = schema
    }
    call(input) {
        const { city, unit } = input
    }
}