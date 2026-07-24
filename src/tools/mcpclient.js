import {  MultiServerMCPClient } from '@langchain/mcp-adapters'

const client = new MultiServerMCPClient({
    'filesystem': {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/workspace']
    }
})

const tools = await client.getTools()


await client.close()