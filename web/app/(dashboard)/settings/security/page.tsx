"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Check, KeyRound, AlertCircle } from "lucide-react"
import { changePassword, isLoggedIn } from "@/lib/api"

export default function SecuritySettingsPage() {
  const router = useRouter()

  // Password state
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push("/login")
    }
  }, [router])

  // ─── Password ───
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPwError("")
    setPwSuccess(false)

    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match")
      return
    }

    setPwLoading(true)
    try {
      await changePassword(oldPassword, newPassword)
      setPwSuccess(true)
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : "Failed to change password")
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div className="grid gap-6">
      {/* Password Card */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border/50">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <KeyRound className="size-4 text-primary" />
            Account Password
          </CardTitle>
          <CardDescription className="text-xs">
            Update your administrative login password
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 max-w-xl">
            {pwError && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2 flex items-center gap-2 border border-destructive/20">
                <AlertCircle className="size-4 shrink-0" />
                <span className="font-medium">{pwError}</span>
              </div>
            )}
            {pwSuccess && (
              <div className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm px-3 py-2 flex items-center gap-2 border border-emerald-500/20">
                <Check className="size-4 shrink-0" />
                <span className="font-medium">Password updated successfully</span>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="old-password">Current Password</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>
              
              <Separator className="my-2 bg-border/50" />
              
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
              
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={4}
                />
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={pwLoading} className="w-full sm:w-auto">
                {pwLoading ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
