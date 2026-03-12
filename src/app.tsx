import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AgentsProvider } from '@/contexts/agents-context'
import { initLogToFile } from '@/lib/log-to-file'
import { AgentStreamProvider } from '@/contexts/agent-stream-context'
import { TeamsProvider } from '@/contexts/teams-context'
import { AppSidebar } from '@/components/app-sidebar'
import { TopNav } from '@/components/top-nav'
import { InboxProvider } from '@/contexts/inbox-context'
import { McpProvider } from '@/contexts/mcp-context'
import { ProjectsProvider } from '@/contexts/projects-context'
import { AddAgentPage } from '@/pages/add-agent'
import { AgentPage } from '@/pages/agent'
import { AssetsPage } from '@/pages/assets'
import { DashboardPage } from '@/pages/dashboard'
import { InboxPage } from '@/pages/inbox'
import { AddMcpPage } from '@/pages/add-mcp'
import { McpDetailPage } from '@/pages/mcp-detail'
import { McpListPage } from '@/pages/mcp-list'
import { InternalToolDetailPage } from '@/pages/internal-tool-detail'
import { NewProjectPage } from '@/pages/new-project'
import { PreferencesPage } from '@/pages/preferences'
import { ProfilePage } from '@/pages/profile'
import { ProjectPage } from '@/pages/project'
import { ProjectSettingsPage } from '@/pages/project-settings'
import { SettingsPage } from '@/pages/settings'
function App() {
  useEffect(() => {
    return initLogToFile()
  }, [])

  // Paste directly without showing the native context menu (e.g. macOS webview "Paste" popup)
  useEffect(() => {
    function insertTextAtFocus(text: string) {
      const el = document.activeElement as HTMLInputElement | HTMLTextAreaElement | HTMLElement | null
      if (!el) return
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const start = el.selectionStart ?? el.value.length
        const end = el.selectionEnd ?? el.value.length
        const next = el.value.slice(0, start) + text + el.value.slice(end)
        el.value = next
        el.selectionStart = el.selectionEnd = start + text.length
        el.dispatchEvent(new Event('input', { bubbles: true }))
        return
      }
      if (el.isContentEditable) {
        document.execCommand('insertText', false, text)
      }
    }

    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const text = e.clipboardData?.getData('text/plain') ?? ''
      if (text) insertTextAtFocus(text)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then((text) => {
          if (text) insertTextAtFocus(text)
        }).catch(() => {})
      }
    }

    document.addEventListener('paste', onPaste, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('paste', onPaste, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  return (
    <AgentsProvider>
      <AgentStreamProvider>
        <TeamsProvider>
          <ProjectsProvider>
            <McpProvider>
            <InboxProvider>
            <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
        <TopNav />
        <main className="flex-1 flex flex-col min-h-0 pt-14 p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/agents/new" element={<AddAgentPage />} />
            <Route path="/agents/:agentId" element={<AgentPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/mcp" element={<McpListPage />} />
            <Route path="/mcp/new" element={<AddMcpPage />} />
            <Route path="/mcp/internal/:toolId" element={<InternalToolDetailPage />} />
            <Route path="/mcp/:id" element={<McpDetailPage />} />
            <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </SidebarInset>
    </SidebarProvider>
    </InboxProvider>
    </McpProvider>
    </ProjectsProvider>
    </TeamsProvider>
    </AgentStreamProvider>
    </AgentsProvider>
  )
}

export default App
