import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { connectToEditor, execOnPage, PICTURE_TYPE, pictureOf, showOnPage } from './editor-page'
import { report, toolDescription } from './report'
import { viewOf } from './view-of'

const server = new McpServer({ name: 'houseit', version: '0.1.0' })

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

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
      const content: Content[] = [{ type: 'text', text: report(result) }]

      // A look comes with a picture of what was looked at: the answer about the
      // kitchen and the kitchen itself, framed and picked as a click would have.
      const view = result.ok ? viewOf(command) : undefined
      if (view) {
        const shown = await showOnPage(page, view)
        if (shown.ok) {
          const picture = await pictureOf(page, shown.clear)
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

await server.connect(new StdioServerTransport())
