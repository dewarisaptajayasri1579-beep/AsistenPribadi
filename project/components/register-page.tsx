"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Gagal mendaftar")
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mendaftar")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="glass-card w-full max-w-sm border-0 ring-0">
        <CardHeader className="items-center text-center">
          <div className="mb-2 grid size-12 grid-cols-2 gap-1 rounded-xl border border-primary/30 bg-primary/15 p-2 shadow-[0_0_22px_var(--neon-glow)]" aria-hidden="true">
            <span className="rounded-sm bg-primary" />
            <span className="rounded-sm bg-chart-2" />
            <span className="col-span-2 rounded-sm bg-primary/80" />
          </div>
          <CardTitle className="text-xl">Buat Akun</CardTitle>
          <CardDescription>Gabung ke workspace Director Daily Assistant.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Nama</FieldLabel>
                <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <FieldDescription>Kalau email ini sudah pernah didaftarkan sebagai akun direktur, akun tersebut akan otomatis diaktifkan dengan password baru ini.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <FieldDescription>Minimal 6 karakter.</FieldDescription>
              </Field>
            </FieldGroup>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="h-11 rounded-xl" disabled={pending}>
              <UserPlus data-icon="inline-start" />
              {pending ? "Memproses…" : "Daftar"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Sudah punya akun?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Masuk
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
