import { Link, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Bot,
  ChevronDown,
  FolderKanban,
  FolderTree,
  Inbox,
  LayoutDashboard,
  Plug,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgents } from '@/contexts/agents-context'
import { useAgentStream } from '@/contexts/agent-stream-context'
import { useMcp } from '@/contexts/mcp-context'
import { INTERNAL_TOOLS } from '@/lib/internal-tools'
import { useProjects } from '@/contexts/projects-context'
import { useInbox } from '@/contexts/inbox-context'

const menuButtonClass =
  'flex w-full cursor-pointer items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm h-8 ring-sidebar-ring outline-hidden transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-2'

export function AppSidebar() {
  const location = useLocation()
  const { agents } = useAgents()
  const { streamingAgentIds, agentActions } = useAgentStream()
  const { projects, loading } = useProjects()
  const { tools: mcpTools, loading: mcpLoading } = useMcp()
  const { count: inboxCount } = useInbox()
  const streamingAgents = agents.filter((a) => streamingAgentIds.has(a.id))
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <img src="/logo.svg" alt="" className="size-8 shrink-0 rounded-lg" aria-hidden />
          <span className="text-sm font-semibold truncate group-data-[collapsible=icon]:hidden">
            AgentPM
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard – direct link */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Dashboard"
                  render={<Link to="/" />}
                  isActive={location.pathname === '/'}
                >
                  <LayoutDashboard className="size-4" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Inbox – direct link */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Inbox"
                  render={<Link to="/inbox" />}
                  isActive={location.pathname === '/inbox'}
                >
                  <Inbox className="size-4" />
                  <span>Inbox</span>
                  {inboxCount > 0 && (
                    <SidebarMenuBadge
                      className="rounded-full bg-primary text-[10px] text-primary-foreground"
                      aria-label={`${inboxCount} items in inbox`}
                    >
                      {inboxCount > 99 ? '99+' : inboxCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Assets – direct link */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Assets"
                  render={<Link to="/assets" />}
                  isActive={location.pathname === '/assets'}
                >
                  <FolderTree className="size-4" />
                  <span>Assets</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Agents – dropdown */}
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger className={cn(menuButtonClass)}>
                    <Bot className="size-4" />
                    <span>Agents</span>
                    <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {agents.map((agent) => (
                        <SidebarMenuSubItem key={agent.id}>
                          <SidebarMenuSubButton render={<Link to={`/agents/${agent.id}`} />}>
                            <span className="flex items-center gap-2 min-w-0">
                              {streamingAgentIds.has(agent.id) && (
                                <span
                                  className="size-2 shrink-0 rounded-full bg-green-500 animate-pulse"
                                  title="Streaming"
                                  aria-hidden
                                />
                              )}
                              <span className="truncate">{agent.name}</span>
                            </span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          render={<Link to="/agents/new" />}
                          className="text-muted-foreground"
                        >
                          + Add agent
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Project – dropdown */}
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger className={cn(menuButtonClass)}>
                    <FolderKanban className="size-4" />
                    <span>Projects</span>
                    <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {!loading &&
                        projects.map((project) => (
                          <SidebarMenuSubItem key={project.id}>
                            <div className="flex w-full items-center gap-0 group/row">
                              <SidebarMenuSubButton
                                render={<Link to={`/projects/${project.id}`} />}
                                className="flex-1 min-w-0"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  {project.color && (
                                    <span
                                      className="size-2.5 shrink-0 rounded-[4px]"
                                      style={{ backgroundColor: project.color }}
                                      aria-hidden
                                    />
                                  )}
                                  {project.icon && (
                                    <span className="shrink-0 text-base leading-none" aria-hidden>
                                      {project.icon}
                                    </span>
                                  )}
                                  <span className="truncate">{project.name}</span>
                                </span>
                              </SidebarMenuSubButton>
                              <Link
                                to={`/projects/${project.id}/settings`}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  'shrink-0 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity',
                                  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                                  'group-hover/row:opacity-100 focus:opacity-100 focus:outline-none'
                                )}
                                aria-label="Project settings"
                              >
                                <Settings className="size-4" />
                              </Link>
                            </div>
                          </SidebarMenuSubItem>
                        ))}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          render={<Link to="/projects/new" />}
                          className="text-muted-foreground"
                        >
                          + New project
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* MCP and Tools – dropdown */}
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger className={cn(menuButtonClass)}>
                    <Plug className="size-4" />
                    <span>MCP and Tools</span>
                    <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {/* Internal Tools sub-folder */}
                      <SidebarMenuSubItem>
                        <Collapsible defaultOpen={false} className="group/internal">
                          <CollapsibleTrigger
                            className={cn(
                              menuButtonClass,
                              'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm'
                            )}
                          >
                            <span className="truncate">Internal Tools</span>
                            <ChevronDown className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/internal:rotate-180" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-2 border-l border-sidebar-border pl-2">
                              {INTERNAL_TOOLS.map((tool) => (
                                <SidebarMenuSubItem key={tool.id}>
                                  <SidebarMenuSubButton
                                    render={
                                      <Link to={`/mcp/internal/${tool.id}`} />
                                    }
                                    isActive={
                                      location.pathname ===
                                      `/mcp/internal/${tool.id}`
                                    }
                                  >
                                    <span className="min-w-0 truncate" title={tool.name}>
                                      {tool.name}
                                    </span>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>
                      {!mcpLoading &&
                        mcpTools.map((tool) => (
                          <SidebarMenuSubItem key={tool.id}>
                            <SidebarMenuSubButton
                              render={<Link to={`/mcp/${tool.id}`} />}
                            >
                              <span className="min-w-0 truncate" title={tool.name}>
                                {tool.name}
                              </span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          render={<Link to="/mcp/new" />}
                          className="text-muted-foreground"
                        >
                          + MCP / Tool
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {streamingAgents.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs">Live agent</SidebarGroupLabel>
            <SidebarGroupContent>
              {streamingAgents.map((agent) => {
                const actions = agentActions[agent.id] ?? []
                return (
                  <div
                    key={agent.id}
                    className="rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5 pb-1">
                      <span
                        className="size-1.5 shrink-0 rounded-full bg-green-500 animate-pulse"
                        aria-hidden
                      />
                      <span className="truncate text-xs font-medium text-sidebar-foreground">
                        {agent.name}
                      </span>
                    </div>
                    {actions.length > 0 ? (
                      <ScrollArea className="max-h-24 w-full">
                        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                          {actions.map((entry, i) => (
                            <li key={i} className="truncate">
                              {entry.text}
                            </li>
                          ))}
                        </ul>
                      </ScrollArea>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">No actions yet</p>
                    )}
                  </div>
                )
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              render={<Link to="/settings" />}
              isActive={location.pathname === '/settings'}
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
