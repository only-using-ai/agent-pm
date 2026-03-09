/* eslint-disable react-refresh/only-export-components -- exports InboxProvider and useInbox */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { listInbox } from '@/lib/api'

type InboxContextValue = {
  count: number
  refetch: () => Promise<void>
}

const InboxContext = createContext<InboxContextValue | null>(null)

export function InboxProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0)

  const refetch = useCallback(async () => {
    try {
      const items = await listInbox()
      setCount(items.length)
    } catch {
      setCount(0)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const value = useMemo<InboxContextValue>(
    () => ({ count, refetch }),
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
