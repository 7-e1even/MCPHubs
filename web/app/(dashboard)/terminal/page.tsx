"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Terminal as TerminalIcon, Loader2 } from "lucide-react"
import { isLoggedIn, getTerminalWsUrl } from "@/lib/api"

export default function TerminalPage() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting")
  const [errorMsg, setErrorMsg] = useState("")
  const termRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login")
      return
    }

    if (initRef.current) return
    initRef.current = true

    let terminal: any = null
    let fitAddon: any = null
    let ws: WebSocket | null = null

    async function init() {
      // Dynamic import xterm modules
      const { Terminal } = await import("@xterm/xterm")
      const { FitAddon } = await import("@xterm/addon-fit")

      // Load xterm CSS via link tag if not already loaded
      if (!document.querySelector('link[href*="xterm"]')) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm/css/xterm.min.css"
        document.head.appendChild(link)
      }

      if (!containerRef.current) return

      terminal = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
        theme: {
          background: "#0a0a0a",
          foreground: "#d4d4d4",
          cursor: "#d4d4d4",
          selectionBackground: "#264f78",
          black: "#1e1e1e",
          red: "#f44747",
          green: "#6a9955",
          yellow: "#dcdcaa",
          blue: "#569cd6",
          magenta: "#c586c0",
          cyan: "#4ec9b0",
          white: "#d4d4d4",
        },
        allowProposedApi: true,
      })

      fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(containerRef.current)
      fitAddon.fit()

      termRef.current = terminal

      // Connect WebSocket
      const url = getTerminalWsUrl()
      ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setStatus("connected")
        terminal.focus()
      }

      ws.onmessage = (event) => {
        terminal.write(event.data)
      }

      ws.onerror = () => {
        setStatus("error")
        setErrorMsg("WebSocket 连接失败")
      }

      ws.onclose = (event) => {
        if (event.code === 4001) {
          setStatus("error")
          setErrorMsg("认证失败，请重新登录")
        } else {
          setStatus("disconnected")
        }
        terminal.write("\r\n\x1b[31m[连接已断开]\x1b[0m\r\n")
      }

      // Forward terminal input to WebSocket
      terminal.onData((data: string) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      })

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit()
      })
      resizeObserver.observe(containerRef.current)

      return () => {
        resizeObserver.disconnect()
      }
    }

    init()

    return () => {
      if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close()
      }
      if (terminal) {
        terminal.dispose()
      }
    }
  }, [router])

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <TerminalIcon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Terminal</h1>
            <p className="text-xs text-muted-foreground">
              MCPHubs 服务器 Shell 终端
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            status === "connected" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
            status === "connecting" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
            status === "error" ? "bg-red-500/10 text-red-600 dark:text-red-400" :
            "bg-muted text-muted-foreground"
          }`}>
            {status === "connecting" && <Loader2 className="size-3 animate-spin" />}
            {status === "connected" && <span className="relative flex size-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>}
            {status === "connected" ? "Connected" :
             status === "connecting" ? "Connecting..." :
             status === "error" ? (errorMsg || "Error") :
             "Disconnected"}
          </span>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 rounded-xl border border-border/50 overflow-hidden bg-[#0a0a0a] shadow-lg relative">
        <div ref={containerRef} className="w-full h-full" />
        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-zinc-500">正在连接终端...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
