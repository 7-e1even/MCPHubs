"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { TerminalSquare, Loader2, RotateCcw, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isLoggedIn, getTerminalWsUrl } from "@/lib/api"

export default function TerminalPage() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting")
  const [errorMsg, setErrorMsg] = useState("")
  const termRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<any>(null)
  const initRef = useRef(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const connect = () => {
    // 清理旧连接
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close()
    }
    if (termRef.current) {
      termRef.current.clear()
    }

    setStatus("connecting")
    setErrorMsg("")

    const terminal = termRef.current
    if (!terminal) return

    const url = getTerminalWsUrl()
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setStatus("connected")
      terminal.focus()
      // 发送初始 resize
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
        const dims = fitAddonRef.current.proposeDimensions()
        if (dims) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }))
        }
      }
    }

    ws.onmessage = (event) => {
      terminal.write(event.data)
    }

    ws.onerror = () => {
      setStatus("error")
      setErrorMsg("连接失败")
    }

    ws.onclose = (event) => {
      if (event.code === 4001) {
        setStatus("error")
        setErrorMsg("认证失败，请重新登录")
      } else if (status !== "error") {
        setStatus("disconnected")
      }
      terminal.write("\r\n\x1b[90m[Session ended]\x1b[0m\r\n")
    }

    terminal.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login")
      return
    }

    if (initRef.current) return
    initRef.current = true

    async function init() {
      const { Terminal } = await import("@xterm/xterm")
      const { FitAddon } = await import("@xterm/addon-fit")

      // Load xterm CSS
      if (!document.querySelector('link[href*="xterm"]')) {
        const link = document.createElement("link")
        link.rel = "stylesheet"
        link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm/css/xterm.min.css"
        document.head.appendChild(link)
        // Wait for CSS to load
        await new Promise(resolve => { link.onload = resolve; setTimeout(resolve, 500) })
      }

      if (!containerRef.current) return

      const terminal = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontSize: 14,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
        lineHeight: 1.2,
        letterSpacing: 0,
        theme: {
          background: "#0c0c0c",
          foreground: "#cccccc",
          cursor: "#ffffff",
          cursorAccent: "#0c0c0c",
          selectionBackground: "#264f78",
          selectionForeground: "#ffffff",
          black: "#0c0c0c",
          red: "#c94f4f",
          green: "#13a10e",
          yellow: "#c19c00",
          blue: "#3b78ff",
          magenta: "#881798",
          cyan: "#3a96dd",
          white: "#cccccc",
          brightBlack: "#767676",
          brightRed: "#e74856",
          brightGreen: "#16c60c",
          brightYellow: "#f9f1a5",
          brightBlue: "#3b78ff",
          brightMagenta: "#b4009e",
          brightCyan: "#61d6d6",
          brightWhite: "#f2f2f2",
        },
        allowProposedApi: true,
        scrollback: 5000,
      })

      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      terminal.open(containerRef.current)
      fitAddon.fit()

      termRef.current = terminal
      fitAddonRef.current = fitAddon

      // Resize handling
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          const dims = fitAddon.proposeDimensions()
          if (dims && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }))
          }
        } catch {}
      })
      resizeObserver.observe(containerRef.current)

      // Start connection
      connect()

      return () => {
        resizeObserver.disconnect()
      }
    }

    init()

    return () => {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close()
      }
      if (termRef.current) {
        termRef.current.dispose()
      }
    }
  }, [router])

  const handleReconnect = () => connect()

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const statusConfig = {
    connecting: { color: "bg-amber-500", text: "Connecting...", pulse: true },
    connected: { color: "bg-emerald-500", text: "Connected", pulse: false },
    disconnected: { color: "bg-zinc-500", text: "Disconnected", pulse: false },
    error: { color: "bg-red-500", text: errorMsg || "Error", pulse: false },
  }
  const sc = statusConfig[status]

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-4 gap-3">
      {/* Title Bar */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2.5">
          <TerminalSquare className="size-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Terminal</h1>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`size-2 rounded-full ${sc.color} ${sc.pulse ? "animate-pulse" : ""}`} />
            <span className="text-xs text-muted-foreground">{sc.text}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(status === "disconnected" || status === "error") && (
            <Button variant="outline" size="sm" onClick={handleReconnect} className="h-7 text-xs">
              <RotateCcw className="size-3 mr-1" />
              Reconnect
            </Button>
          )}
          <Button variant="ghost" size="icon" className="size-7" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 rounded-lg border border-border/40 overflow-hidden bg-[#0c0c0c] relative">
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ padding: "8px" }}
        />
        {status === "connecting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0c0c0c]">
            <div className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-sm">Connecting to shell...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
