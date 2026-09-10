import { redirect } from "next/navigation"
import { Clock } from "lucide-react"

import { LogoutButton } from "@/components/logout-button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getOptionalCurrentUser } from "@/lib/current-user"

export const dynamic = "force-dynamic"

// Sengaja memakai getOptionalCurrentUser, BUKAN getCurrentUser: getCurrentUser justru mengarahkan
// akun pending ke halaman ini, jadi memakainya di sini akan bikin redirect berputar.
export default async function Page() {
  const user = await getOptionalCurrentUser()
  if (!user) redirect("/login")
  if (user.approvedAt) redirect("/")

  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="glass-card w-full max-w-md border-0 ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-5 text-primary" aria-hidden="true" />
            Menunggu persetujuan
          </CardTitle>
          <CardDescription>Akunmu sudah terdaftar, tinggal nunggu diaktifkan.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>
            Hai {user.name}, pendaftaranmu sudah masuk dan sekarang lagi nunggu disetujui admin.
            Selama belum disetujui, data belum bisa dibuka dan Naya belum bisa dihubungi lewat
            WhatsApp.
          </p>
          <p>Coba buka halaman ini lagi setelah dapat kabar dari admin ya.</p>
          <LogoutButton />
        </CardContent>
      </Card>
    </main>
  )
}
