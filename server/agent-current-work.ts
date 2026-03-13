/**
 * In-memory registry of which work item each agent is currently processing.
 * Used by "empty queue" to cancel the running stream (setCancelRequested)
 * so the LangChain loop exits.
 */

const currentByAgent = new Map<string, string>()

export function setCurrentWorkItem(agentId: string, workItemId: string): void {
  currentByAgent.set(agentId, workItemId)
}

export function getCurrentWorkItemId(agentId: string): string | undefined {
  return currentByAgent.get(agentId)
}

export function clearCurrentWorkItem(agentId: string): void {
  currentByAgent.delete(agentId)
}
