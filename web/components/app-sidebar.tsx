"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Server,
  LayoutDashboard,
  Settings,
  LogOut,
  Moon,
  Sun,
  ScrollText,
  Bug,
  FolderOpen,
  TerminalSquare,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { clearToken } from "@/lib/api"
import { useTheme } from "next-themes"

const navMain = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "MCP Servers",
    url: "/servers",
    icon: Server,
  },
  {
    title: "Debug",
    url: "/debug",
    icon: Bug,
  },
  {
    title: "File Manager",
    url: "/files",
    icon: FolderOpen,
  },
  {
    title: "Terminal",
    url: "/terminal",
    icon: TerminalSquare,
  },
  {
    title: "Logs",
    url: "/logs",
    icon: ScrollText,
  },
]

const McpLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M18 84.8528L85.8822 16.9706C95.2548 7.59798 110.451 7.59798 119.823 16.9706V16.9706C129.196 26.3431 129.196 41.5391 119.823 50.9117L68.5581 102.177" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <path d="M69.2652 101.47L119.823 50.9117C129.196 41.5391 144.392 41.5391 153.765 50.9117L154.118 51.2652C163.491 60.6378 163.491 75.8338 154.118 85.2063L92.7248 146.6C89.6006 149.724 89.6006 154.789 92.7248 157.913L105.331 170.52" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <path d="M102.853 33.9411L52.6482 84.1457C43.2756 93.5183 43.2756 108.714 52.6482 118.087V118.087C62.0208 127.459 77.2167 127.459 86.5893 118.087L136.794 67.8822" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
  </svg>
)

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  function handleLogout() {
    clearToken()
    router.push("/login")
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <McpLogo className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold text-base">McpHub</span>
                  <span className="text-xs text-muted-foreground">Admin Portal</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="px-2 mt-4 gap-1">
          {navMain.map((item) => {
            const isActive =
              item.url === "/"
                ? pathname === "/"
                : pathname.startsWith(item.url)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings" isActive={pathname.startsWith("/settings")}>
              <a href="/settings">
                <Settings />
                <span>Settings</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Toggle Theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
              <span>Toggle Theme</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" onClick={handleLogout}>
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
