import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { connectToEditor, execOnPage } from './editor-page'
import { report, toolDescription } from './report'

const server = new McpServer({ name: 'houseit', version: '0.1.0' })

/**
 * One tool, not one per action. Adding a command leaves the tool surface
 * unchanged, and the agent can batch several commands into one transaction.
 */
server.registerTool(
  'floorplan',
  {
    title: 'Edit the floor plan',
    description: toolDescription(),
    inputSchema: {
      command: z
        .string()
        .describe('One or more commands, one per line. Applied as a single transaction.'),
    },
  },
  async ({ command }) => {
    try {
      const page = await connectToEditor()
      const result = await execOnPage(page, command)
      return { content: [{ type: 'text', text: report(result) }], isError: !result.ok }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { content: [{ type: 'text', text: message }], isError: true }
    }
  },
)

await server.connect(new StdioServerTransport())
