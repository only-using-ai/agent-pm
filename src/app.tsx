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
import { ContextPage } from '@/pages/context'
import { DashboardPage } from '@/pages/dashboard'
import { InboxPage } from '@/pages/inbox'
import { AddMcpPage } from '@/pages/add-mcp'
import { McpDetailPage } from '@/pages/mcp-detail'
import { McpListPage } from '@/pages/mcp-list'
import { NewProjectPage } from '@/pages/new-project'
import { ProfilePage } from '@/pages/profile'
import { ProjectPage } from '@/pages/project'
import { ProjectSettingsPage } from '@/pages/project-settings'
import { SettingsPage } from '@/pages/settings'
import { WorkItemsPage } from '@/pages/work-items'

function App() {
  useEffect(() => {
    return initLogToFile()
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
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/work-items" element={<WorkItemsPage />} />
            <Route path="/assets" element={<AssetsPage />} />
            <Route path="/context" element={<ContextPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/agents/new" element={<AddAgentPage />} />
            <Route path="/agents/:agentId" element={<AgentPage />} />
            <Route path="/projects/new" element={<NewProjectPage />} />
            <Route path="/projects/:projectId" element={<ProjectPage />} />
            <Route path="/mcp" element={<McpListPage />} />
            <Route path="/mcp/new" element={<AddMcpPage />} />
            <Route path="/mcp/:id" element={<McpDetailPage />} />
            <Route path="/projects/:projectId/settings" element={<ProjectSettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
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
