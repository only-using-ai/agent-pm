/**
 * Internal agent actions (__AGENT_ACTION__) from event-prompts.ts.
 * Used for the MCP → Internal Tools menu and detail pages.
 */

export interface InternalToolParameter {
  name: string
  type: string
  description: string
}

export interface InternalTool {
  id: string
  name: string
  description: string
  example: string
  parameters: InternalToolParameter[]
}

export const INTERNAL_TOOLS: InternalTool[] = [
  {
    id: 'update_work_item_status',
    name: 'Update Work Item Status',
    description:
      'Update the status of the current work item. Use at the start of work (in_progress) and when done (completed).',
    example: '__AGENT_ACTION__ update_work_item_status {"status":"in_progress"}',
    parameters: [
      {
        name: 'status',
        type: 'string',
        description: 'One of: todo, in_progress, completed, blocked, canceled',
      },
    ],
  },
  {
    id: 'add_work_item_comment',
    name: 'Add Work Item Comment',
    description: 'Add a comment to the current work item (e.g. progress notes or task breakdown).',
    example: '__AGENT_ACTION__ add_work_item_comment {"body":"Your comment text here"}',
    parameters: [
      {
        name: 'body',
        type: 'string',
        description: 'The comment text to add',
      },
    ],
  },
  {
    id: 'request_for_approval',
    name: 'Request for Approval',
    description:
      'Ask the user to approve something before continuing. Use when the work item requires approval. Wait for Approve or Reject in the Inbox before continuing.',
    example:
      '__AGENT_ACTION__ request_for_approval {"text":"What you are asking approval for","work_item_id":"<WORK_ITEM_ID>","agent_name":"Your agent name"}',
    parameters: [
      { name: 'text', type: 'string', description: 'What you are asking approval for' },
      { name: 'work_item_id', type: 'string', description: 'The work item ID' },
      { name: 'agent_name', type: 'string', description: 'Your agent name' },
    ],
  },
  {
    id: 'request_info',
    name: 'Request Info',
    description: 'Ask the user for information needed to proceed.',
    example:
      '__AGENT_ACTION__ request_info {"message":"What you need from the user","work_item_id":"<WORK_ITEM_ID>","agent_name":"Your agent name"}',
    parameters: [
      { name: 'message', type: 'string', description: 'What you need from the user' },
      { name: 'work_item_id', type: 'string', description: 'The work item ID' },
      { name: 'agent_name', type: 'string', description: 'Your agent name' },
    ],
  },
  {
    id: 'list_available_agents',
    name: 'List Available Agents',
    description:
      'Get the list of available agents. Call this first if you need to create and assign a work item.',
    example: '__AGENT_ACTION__ list_available_agents {}',
    parameters: [],
  },
  {
    id: 'create_work_item_and_assign',
    name: 'Create Work Item and Assign',
    description: 'Create a new work item and assign it to an agent. Use list_available_agents first to get agent IDs.',
    example:
      '__AGENT_ACTION__ create_work_item_and_assign {"title":"...","assigned_to_agent_id":"<agent_id>","description":"...","priority":"Medium","depends_on":"<work_item_id>"}',
    parameters: [
      { name: 'title', type: 'string', description: 'Work item title' },
      { name: 'assigned_to_agent_id', type: 'string', description: 'Agent ID to assign to' },
      { name: 'description', type: 'string', description: 'Work item description' },
      { name: 'priority', type: 'string', description: 'e.g. Medium' },
      { name: 'depends_on', type: 'string', description: 'Optional parent work item ID' },
    ],
  },
  {
    id: 'link_asset_to_work_item',
    name: 'Link Asset to Work Item',
    description: 'Link an existing asset to the current work item.',
    example: '__AGENT_ACTION__ link_asset_to_work_item {"asset_id":"<asset_uuid>"}',
    parameters: [
      { name: 'asset_id', type: 'string', description: 'UUID of the existing asset' },
    ],
  },
  {
    id: 'create_asset_and_link_to_work_item',
    name: 'Create Asset and Link to Work Item',
    description:
      'Create a new asset (e.g. a file you just created) and link it to the current work item.',
    example:
      '__AGENT_ACTION__ create_asset_and_link_to_work_item {"name":"...","type":"file","path":"..."}',
    parameters: [
      { name: 'name', type: 'string', description: 'Asset name' },
      { name: 'type', type: 'string', description: 'One of: file, link, folder' },
      { name: 'path', type: 'string', description: 'Optional path (for files)' },
      { name: 'url', type: 'string', description: 'Optional URL (for links)' },
    ],
  },
]

export function getInternalToolById(id: string): InternalTool | undefined {
  return INTERNAL_TOOLS.find((t) => t.id === id)
}
