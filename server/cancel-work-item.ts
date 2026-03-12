/**
 * In-memory registry of work item IDs for which the user requested cancellation.
 * When a handler is streaming agent output for a work item, it checks this set
 * each chunk and breaks out immediately if the work item was cancelled.
 */

const cancelledIds = new Set<string>()

export function setCancelRequested(workItemId: string): void {
  cancelledIds.add(workItemId)
}

export function isCancelRequested(workItemId: string): boolean {
  return cancelledIds.has(workItemId)
}

export function clearCancelRequested(workItemId: string): void {
  cancelledIds.delete(workItemId)
}
