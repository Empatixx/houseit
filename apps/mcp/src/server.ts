import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  closeEditor,
  connectToEditor,
  execOnPage,
  PICTURE_TYPE,
  pictureOf,
  showOnPage,
} from './editor-page'
import { helpText, report, toolDescription } from './report'
import { viewOf } from './view-of'

const server = new McpServer({ name: 'houseit', version: '0.1.0' })

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

server.registerTool(
  'floorplan',
  {
    title: 'Edit the floor plan',
    description: toolDescription(),
    inputSchema: {
      command: z
        .string()
        .describe(
          'One or more commands, one per line, applied as a single transaction. `help` for the list.',
        ),
    },
  },
  async ({ command }) => {
    try {
      if (command.trim() === 'help') {
        return { content: [{ type: 'text', text: helpText() }] }
      }

      const page = await connectToEditor()
      const result = await execOnPage(page, command)
      const content: Content[] = [{ type: 'text', text: report(result) }]

      if (result.ok) {
        const shown = await showOnPage(page, viewOf(result.answer))
        if (shown.ok) {
          const picture = await pictureOf(page)
          content.push({ type: 'image', data: picture.toString('base64'), mimeType: PICTURE_TYPE })
        }
      }
      return { content, isError: !result.ok }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { content: [{ type: 'text', text: message }], isError: true }
    }
  },
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void closeEditor().then(() => process.exit(0))
  })
}

await server.connect(new StdioServerTransport())
