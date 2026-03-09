/**
 * Registers MCP (Model Context Protocol) servers as LangChain tools.
 * Loads MCP configs, connects to each server (stdio or Streamable HTTP),
 * lists tools, and returns LangChain StructuredToolInterface for each.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { tool } from '@langchain/core/tools'
import type { StructuredToolInterface } from '@langchain/core/tools'
import { z } from 'zod'
import type { McpToolRow } from '../services/types.js'

/** One MCP server connection + its tools for LangChain. */
async function connectAndListTools(
  config: McpToolRow
): Promise<{ client: Client; toolNames: string[]; descriptions: Map<string, string> }> {
  const client = new Client(
    { name: 'agent-pm', version: '1.0.0' },
    { capabilities: {} }
  )

  if (config.type === 'command' && config.command) {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: config.env && Object.keys(config.env).length > 0 ? config.env : undefined,
    })
    await client.connect(transport)
  } else if (config.type === 'url' && config.url) {
    const url = config.url.startsWith('http') ? config.url : `https://${config.url}`
    const transport = new StreamableHTTPClientTransport(new URL(url))
    await client.connect(transport)
  } else {
    throw new Error(`MCP config "${config.name}": type ${config.type} requires ${config.type === 'command' ? 'command' : 'url'}`)
  }

  const listResult = await client.listTools()
  const tools = listResult?.tools ?? []
  const toolNames = tools.map((t) => t.name as string)
  const descriptions = new Map<string, string>()
  for (const t of tools) {
    const name = t.name as string
    descriptions.set(name, (t.description as string) ?? name)
  }
  return { client, toolNames, descriptions }
}

/**
 * Build LangChain tools from MCP configs. Connects to each MCP server,
 * lists its tools, and returns one LangChain tool per MCP tool.
 * Tools are named with a prefix to avoid collisions: mcp__<config_name>__<tool_name>.
 */
export async function createMcpLangChainTools(
  configs: McpToolRow[]
): Promise<StructuredToolInterface[]> {
  const result: StructuredToolInterface[] = []

  for (const config of configs) {
    try {
      const { client, toolNames, descriptions } = await connectAndListTools(config)
      const prefix = `mcp__${config.name.replace(/\W/g, '_')}__`

      for (const toolName of toolNames) {
        const description = descriptions.get(toolName) ?? toolName
        const langchainName = `${prefix}${toolName}`.replace(/\s+/g, '_')
        const argsSchema = z.object({
          arguments: z.record(z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), z.record(z.unknown())])).optional().describe('Tool arguments as key-value pairs'),
        })
        const lcTool = tool(
          async (input: { arguments?: Record<string, unknown> }) => {
            const args = input?.arguments ?? {}
            const res = await client.callTool({ name: toolName, arguments: args })
            const content = res?.content
            if (Array.isArray(content)) {
              const parts = content.map((c) => {
                if (c && typeof c === 'object' && 'text' in c && typeof (c as { text: string }).text === 'string') {
                  return (c as { text: string }).text
                }
                return JSON.stringify(c)
              })
              return parts.join('\n')
            }
            return typeof res === 'string' ? res : JSON.stringify(res ?? '')
          },
          {
            name: langchainName,
            description: `[MCP: ${config.name}] ${description}`,
            schema: argsSchema,
          }
        )
        result.push(lcTool)
      }
    } catch (err) {
      console.error(`[mcp-langchain] Failed to connect to MCP "${config.name}":`, err)
    }
  }

  return result
}
