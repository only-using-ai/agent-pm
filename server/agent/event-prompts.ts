/**
 * Prompt builder service: builds AgentContext for domain events (e.g. work_item.created).
 * Takes the agent and event payload and constructs instructions for the agent to work with the data.
 * Supports template overrides from the DB with variables like 'WORK_ITEM_TITLE', 'AGENT_PROVIDER', etc.
 */

import type { AgentRecord, AgentContext } from './types.js'

export interface WorkItemCreatedPayload {
  id: string
  project_id: string
  title: string | null
  description?: string | null
  priority?: string | null
  status?: string | null
  assigned_to?: string | null
  depends_on?: string | null
  require_approval?: boolean
  [key: string]: unknown
}

/** Same shape as work item row; used for assignment_change event. */
export interface WorkItemAssignmentChangePayload {
  id: string
  project_id: string
  title: string | null
  description?: string | null
  priority?: string | null
  status?: string | null
  assigned_to?: string | null
  depends_on?: string | null
  require_approval?: boolean
  [key: string]: unknown
}

/** Replace 'VARIABLE_NAME' placeholders (single-quoted, ALL_CAPS_SNAKE_CASE) with values. */
export function substitutePromptVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/'([A-Z][A-Z0-9_]*)'/g, (_, key) => {
    return key in variables ? String(variables[key]) : `'${key}'`
  })
}

/** Cursor CLI: one line per action, format __AGENT_ACTION__ <tool> <json>. */
const CURSOR_ACTIONS_INSTRUCTIONS = `Because you are running in Cursor CLI mode, you do not have direct tool calls. Output exactly one line per action with no other text on that line. The system will execute these and replace them with a short confirmation.

Actions (use the exact tool name and JSON):
- __AGENT_ACTION__ update_work_item_status {"status":"in_progress"}  (status: one of todo, in_progress, completed, blocked, canceled)
- __AGENT_ACTION__ add_work_item_comment {"body":"Your comment text here"}
- __AGENT_ACTION__ request_for_approval {"text":"What you are asking approval for","work_item_id":"<WORK_ITEM_ID>","agent_name":"Your agent name"}  Use this when the work item requires approval (Require Approval is true). Wait for the user to Approve or Reject in the Inbox before continuing with tasks.
- __AGENT_ACTION__ request_info {"message":"What you need from the user","work_item_id":"<WORK_ITEM_ID>","agent_name":"Your agent name"}
- __AGENT_ACTION__ list_available_agents {}  (call first if you need to create and assign a work item)
- __AGENT_ACTION__ create_work_item_and_assign {"title":"...","assigned_to_agent_id":"<agent_id>","description":"...","priority":"Medium","depends_on":"<work_item_id>"}`

/**
 * Build the variable map for work-item-created prompt substitution.
 * Use these keys in templates as 'WORK_ITEM_TITLE', 'AGENT_PROVIDER', etc.
 */
export function getWorkItemCreatedPromptVariables(
  agent: AgentRecord,
  payload: WorkItemCreatedPayload
): Record<string, string> {
  const isCursor = (agent.ai_provider ?? '').toLowerCase() === 'cursor'
  const cursorBlock = isCursor ? CURSOR_ACTIONS_INSTRUCTIONS : ''
  return {
    WORK_ITEM_ID: payload.id,
    WORK_ITEM_TITLE: payload.title?.trim() || 'Untitled',
    WORK_ITEM_DESCRIPTION: payload.description?.trim() || 'None',
    WORK_ITEM_PRIORITY: payload.priority ?? 'Medium',
    WORK_ITEM_STATUS: payload.status ?? 'todo',
    WORK_ITEM_REQUIRE_APPROVAL: payload.require_approval === true ? 'true' : 'false',
    PROJECT_ID: payload.project_id,
    AGENT_INSTRUCTIONS: agent.instructions?.trim() ?? 'Assist the user.',
    AGENT_PROVIDER: (agent.ai_provider ?? 'ollama').toLowerCase(),
    CURSOR_ACTIONS_BLOCK: cursorBlock,
  }
}

/**
 * Build agent context for the "work_item.created" event.
 * If options.template is provided (e.g. from DB), substitutes variables and uses it as userMessage;
 * otherwise uses the built-in buildWorkItemCreatedUserMessage.
 */
export function buildContextForWorkItemCreated(
  agent: AgentRecord,
  payload: WorkItemCreatedPayload,
  options?: { template?: string | null }
): AgentContext {
  const userMessage =
    options?.template != null && options.template !== ''
      ? substitutePromptVariables(
          options.template,
          getWorkItemCreatedPromptVariables(agent, payload)
        )
      : buildWorkItemCreatedUserMessage(agent, payload)
  return {
    userMessage,
    context: {
      work_item: {
        id: payload.id,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        status: payload.status,
        depends_on: payload.depends_on,
      },
    },
    variables: {
      work_item_title: payload.title ?? '',
      work_item_id: payload.id,
      project_id: payload.project_id,
    },
  }
}

/**
 * Build the user message that instructs the agent how to work with the newly created work item.
 * Can be extended to use agent-specific or team-specific templates later.
 */
function buildWorkItemCreatedUserMessage(
  agent: AgentRecord,
  payload: WorkItemCreatedPayload
): string {
  const title = payload.title?.trim() || 'Untitled'
  const hasDescription = payload.description?.trim()
  const isCursor = (agent.ai_provider ?? '').toLowerCase() === 'cursor'
  const parts: string[] = [
    `You are an AI agent. Your role is: ${agent.instructions}`,
    `A new work item was created and assigned to you: "${title}".`,
    hasDescription
      ? `Description: ${payload.description?.trim() ?? ''}`
      : '',
    `Priority: ${payload.priority ?? 'Medium'}. Status: ${payload.status ?? 'todo'}.`,
    'You are to complete this work item.',
    'You are to use the following steps to complete the work item:',
    '1. Understand the work item',
    '2. Call the update_work_item_status("in_progress") tool to update the status to in_progress',
    '3. Break down the work item into smaller tasks and subtasks (do not reveal these tasks and subtasks to the user)',
    '4. Complete all of the tasks and subtasks',
    '5. Add a comment to the work item with notes relevant to the tasks and subtasks by using the tool add_work_item_comment',
    '6. Once the work item is complete, call the tool update_work_item_status and update the status to completed',
    'Be concise and brief to the user unless otherwise instructed.',
    'If the user asks to create new work items, issues, or stories, use the tool create_work_item_and_assign to create the new work item and assign it to the user. Use the list_available_agents tool to get the list of available agents to assign the new work item to.',
  ]
  if (isCursor) {
    parts.push(CURSOR_ACTIONS_INSTRUCTIONS)
  }
  return parts.filter(Boolean).join(' ')
}

/**
 * Build agent context for the "work_item.assignment_change" event (work item reassigned to this agent).
 * Same structure as work_item.created but with a reassignment-focused user message.
 */
export function buildContextForWorkItemAssignmentChange(
  agent: AgentRecord,
  payload: WorkItemAssignmentChangePayload,
  options?: { template?: string | null }
): AgentContext {
  const userMessage =
    options?.template != null && options.template !== ''
      ? substitutePromptVariables(
          options.template,
          getWorkItemCreatedPromptVariables(agent, payload as WorkItemCreatedPayload)
        )
      : buildWorkItemAssignmentChangeUserMessage(agent, payload)
  return {
    userMessage,
    context: {
      work_item: {
        id: payload.id,
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        status: payload.status,
        depends_on: payload.depends_on,
      },
    },
    variables: {
      work_item_title: payload.title ?? '',
      work_item_id: payload.id,
      project_id: payload.project_id,
    },
  }
}

function buildWorkItemAssignmentChangeUserMessage(
  agent: AgentRecord,
  payload: WorkItemAssignmentChangePayload
): string {
  const title = payload.title?.trim() || 'Untitled'
  const hasDescription = payload.description?.trim()
  const isCursor = (agent.ai_provider ?? '').toLowerCase() === 'cursor'
  const parts: string[] = [
    `You are an AI agent. Your role is: ${agent.instructions}`,
    `This work item was reassigned to you: "${title}".`,
    hasDescription
      ? `Description: ${payload.description?.trim() ?? ''}`
      : '',
    `Priority: ${payload.priority ?? 'Medium'}. Status: ${payload.status ?? 'todo'}.`,
    'You are to complete this work item.',
    'You are to use the following steps to complete the work item:',
    '1. Understand the work item',
    '2. Call the update_work_item_status("in_progress") tool to update the status to in_progress',
    '3. Break down the work item into smaller tasks and subtasks (do not reveal these tasks and subtasks to the user)',
    '4. Complete all of the tasks and subtasks',
    '5. Add a comment to the work item with notes relevant to the tasks and subtasks by using the tool add_work_item_comment',
    '6. Once the work item is complete, call the tool update_work_item_status and update the status to completed',
    'Be concise and brief to the user unless otherwise instructed.',
    'If the user asks to create new work items, issues, or stories, use the tool create_work_item_and_assign to create the new work item and assign it to the user. Use the list_available_agents tool to get the list of available agents to assign the new work item to.',
  ]
  if (isCursor) {
    parts.push(CURSOR_ACTIONS_INSTRUCTIONS)
  }
  return parts.filter(Boolean).join(' ')
}

/** Payload for work_item.approved: approval request row fields needed to resume the agent. */
export interface WorkItemApprovedPayload {
  work_item_id: string
  project_id: string
  agent_id: string | null
  agent_name: string
  body: string
}

/**
 * Build agent context for the "work_item.approved" event (user approved in Inbox).
 * Tells the agent to continue with the work item after approval.
 */
export function buildContextForWorkItemApproved(
  agent: AgentRecord,
  workItem: WorkItemAssignmentChangePayload,
  options: { approvalBody: string }
): AgentContext {
  const title = workItem.title?.trim() || 'Untitled'
  const userMessage = [
    `You are an AI agent. Your role is: ${agent.instructions}`,
    `The user approved your request for the work item "${title}".`,
    options.approvalBody?.trim()
      ? `What was approved: "${options.approvalBody.trim()}"`
      : '',
    'Continue with the work item: complete any remaining tasks, add a comment with notes if relevant, and update the status to completed when done.',
    'Be concise and brief unless otherwise instructed.',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    userMessage,
    context: {
      work_item: {
        id: workItem.id,
        title: workItem.title,
        description: workItem.description,
        priority: workItem.priority,
        status: workItem.status,
        depends_on: workItem.depends_on,
      },
    },
    variables: {
      work_item_title: workItem.title ?? '',
      work_item_id: workItem.id,
      project_id: workItem.project_id,
    },
  }
}
