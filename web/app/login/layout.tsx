/**
 * Login Layout — 独立布局，不包含 Sidebar
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh flex items-center justify-center bg-background">
      {children}
    </div>
  )
}
