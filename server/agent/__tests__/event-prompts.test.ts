import { describe, it, expect } from 'vitest'
import {
  substitutePromptVariables,
  getWorkItemCreatedPromptVariables,
  formatWorkItemComments,
  getWorkItemCommentedPromptVariables,
  buildContextForWorkItemCreated,
  buildContextForWorkItemAssignmentChange,
} from '../event-prompts.js'
import type { AgentRecord } from '../types.js'

const baseAgent: AgentRecord = {
  id: 'a1',
  name: 'Agent',
  team_id: 't1',
  instructions: 'Help.',
  ai_provider: 'ollama',
  model: 'llama3',
}

describe('event-prompts', () => {
  describe('substitutePromptVariables', () => {
    it('replaces single-quoted ALL_CAPS variable', () => {
      const out = substitutePromptVariables("Do 'WORK_ITEM_TITLE'", { WORK_ITEM_TITLE: 'Fix bug' })
      expect(out).toBe('Do Fix bug')
    })

    it('keeps placeholder when variable missing', () => {
      const out = substitutePromptVariables("Do 'WORK_ITEM_TITLE'", {})
      expect(out).toBe("Do 'WORK_ITEM_TITLE'")
    })

    it('replaces multiple variables', () => {
      const out = substitutePromptVariables("'A' and 'B'", { A: '1', B: '2' })
      expect(out).toBe('1 and 2')
    })
  })

  describe('getWorkItemCreatedPromptVariables', () => {
    it('returns variable map from payload and agent', () => {
      const payload = {
        id: 'wi-1',
        project_id: 'p-1',
        title: ' Task ',
        description: ' Desc ',
        priority: 'High',
        status: 'in_progress',
        require_approval: true,
        work_item_type: 'Bug',
      }
      const vars = getWorkItemCreatedPromptVariables(baseAgent, payload)
      expect(vars.WORK_ITEM_ID).toBe('wi-1')
      expect(vars.WORK_ITEM_TITLE).toBe('Task')
      expect(vars.WORK_ITEM_DESCRIPTION).toBe('Desc')
      expect(vars.WORK_ITEM_PRIORITY).toBe('High')
      expect(vars.WORK_ITEM_STATUS).toBe('in_progress')
      expect(vars.WORK_ITEM_TYPE).toBe('Bug')
      expect(vars.WORK_ITEM_REQUIRE_APPROVAL).toBe('true')
      expect(vars.PROJECT_ID).toBe('p-1')
      expect(vars.AGENT_INSTRUCTIONS).toBe('Help.')
      expect(vars.AGENT_PROVIDER).toBe('ollama')
    })

    it('uses defaults for null/empty', () => {
      const payload = {
        id: 'wi-1',
        project_id: 'p-1',
        title: null,
        description: null,
        priority: null,
        status: null,
        require_approval: false,
      }
      const vars = getWorkItemCreatedPromptVariables(baseAgent, payload)
      expect(vars.WORK_ITEM_TITLE).toBe('Untitled')
      expect(vars.WORK_ITEM_DESCRIPTION).toBe('None')
      expect(vars.WORK_ITEM_PRIORITY).toBe('Medium')
      expect(vars.WORK_ITEM_STATUS).toBe('todo')
      expect(vars.WORK_ITEM_TYPE).toBe('Task')
      expect(vars.WORK_ITEM_REQUIRE_APPROVAL).toBe('false')
    })

    it('includes CURSOR_ACTIONS_BLOCK when provider is cursor', () => {
      const agent: AgentRecord = { ...baseAgent, ai_provider: 'cursor' }
      const payload = { id: 'wi-1', project_id: 'p-1', title: 'T', require_approval: false }
      const vars = getWorkItemCreatedPromptVariables(agent, payload)
      expect(vars.CURSOR_ACTIONS_BLOCK).toContain('__AGENT_ACTION__')
    })

    it('includes areaContext and projectContext from options', () => {
      const vars = getWorkItemCreatedPromptVariables(baseAgent, { id: 'wi-1', project_id: 'p-1', title: 'T', require_approval: false }, {
        areaContext: 'Area',
        projectContext: 'Project',
      })
      expect(vars.AREA_CONTEXT).toBe('Area')
      expect(vars.PROJECT_CONTEXT).toBe('Project')
    })
  })

  describe('formatWorkItemComments', () => {
    it('returns "No comments yet." when empty', () => {
      expect(formatWorkItemComments([])).toBe('No comments yet.')
    })

    it('formats comments with author and date', () => {
      const comments = [
        { author_type: 'user', author_id: null, body: 'Hello', created_at: '2024-01-15T10:00:00Z' },
      ]
      const out = formatWorkItemComments(comments)
      expect(out).toContain('User')
      expect(out).toContain('Hello')
      expect(out).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    })

    it('uses agentNames map for agent author', () => {
      const comments = [
        { author_type: 'agent', author_id: 'agent-1', body: 'Done', created_at: '2024-01-15T10:00:00Z' },
      ]
      const agentNames = new Map([['agent-1', 'My Agent']])
      const out = formatWorkItemComments(comments, agentNames)
      expect(out).toContain('My Agent')
      expect(out).toContain('Done')
    })
  })

  describe('getWorkItemCommentedPromptVariables', () => {
    it('includes WORK_ITEM_COMMENTS', () => {
      const workItem = {
        id: 'wi-1',
        project_id: 'p-1',
        title: 'Item',
        comments: [
          { author_type: 'user', author_id: null, body: 'Comment', created_at: '2024-01-01T00:00:00Z' },
        ],
      }
      const vars = getWorkItemCommentedPromptVariables(baseAgent, workItem)
      expect(vars.WORK_ITEM_COMMENTS).toContain('Comment')
    })
  })

  describe('buildContextForWorkItemCreated', () => {
    const payload = {
      id: 'wi-1',
      project_id: 'p-1',
      title: 'New task',
      description: null,
      priority: 'Medium',
      status: 'todo',
      require_approval: false,
    }

    it('returns context with userMessage and work_item', () => {
      const ctx = buildContextForWorkItemCreated(baseAgent, payload)
      expect(ctx.userMessage).toBeDefined()
      expect(ctx.context?.work_item).toEqual({
        id: 'wi-1',
        title: 'New task',
        description: null,
        priority: 'Medium',
        status: 'todo',
        depends_on: undefined,
      })
      expect(ctx.variables?.work_item_id).toBe('wi-1')
      expect(ctx.variables?.work_item_title).toBe('New task')
    })

    it('uses template when provided', () => {
      const ctx = buildContextForWorkItemCreated(baseAgent, payload, {
        template: "Work on 'WORK_ITEM_TITLE'",
        areaContext: '',
        projectContext: '',
      })
      expect(ctx.userMessage).toContain('Work on New task')
    })
  })

  describe('buildContextForWorkItemAssignmentChange', () => {
    const payload = {
      id: 'wi-1',
      project_id: 'p-1',
      title: 'Reassigned',
      assigned_to: 'agent-1',
      require_approval: false,
    }

    it('returns context with work_item', () => {
      const ctx = buildContextForWorkItemAssignmentChange(baseAgent, payload)
      expect(ctx.context?.work_item).toBeDefined()
      expect(ctx.userMessage).toBeDefined()
    })
  })
})
