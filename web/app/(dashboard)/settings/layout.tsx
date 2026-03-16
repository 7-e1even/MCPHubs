"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Settings, ShieldCheck, BrainCircuit, Blocks } from "lucide-react"

const sidebarNavItems = [
  {
    title: "General",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "LLM",
    href: "/settings/llm",
    icon: BrainCircuit,
  },
  {
    title: "Integrations",
    href: "/settings/integrations",
    icon: Blocks,
  },
  {
    title: "Security",
    href: "/settings/security",
    icon: ShieldCheck,
  },
]

interface SettingsLayoutProps {
  children: React.ReactNode
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col gap-8 p-4 md:p-6 max-w-5xl mx-auto w-full">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground text-sm">
          Manage your account settings and API integrations.
        </p>
      </div>
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="lg:w-1/5 overflow-x-auto">
          <nav className="flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1">
            {sidebarNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    isActive
                      ? "bg-muted hover:bg-muted"
                      : "hover:bg-transparent hover:underline",
                    "justify-start flex items-center gap-2 whitespace-nowrap"
                  )}
                >
                  <Icon className="size-4" />
                  {item.title}
                </Link>
              )
            })}
          </nav>
        </aside>
        <div className="flex-1 max-w-3xl">{children}</div>
      </div>
    </div>
  )
}
