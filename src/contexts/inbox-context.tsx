/* eslint-disable react-refresh/only-export-components -- exports InboxProvider and useInbox */
import { createContext, useContext, useMemo } from 'react'
import { useInboxQuery } from '@/hooks/queries'

type InboxContextValue = {
  count: number
  refetch: () => Promise<void>
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const { data, refetch } = useInboxQuery()
  const count = data?.length ?? 0

  const value = useMemo<InboxContextValue>(
    () => ({
      count,
      refetch: async () => {
        await refetch()
      },
    }),
    [count, refetch]
  )

  return (
    <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
  )
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('useInbox must be used within InboxProvider')
  return ctx
}
