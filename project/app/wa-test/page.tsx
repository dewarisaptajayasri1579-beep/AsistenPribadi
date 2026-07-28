import { WaTestPanel } from "@/components/wa-test-panel"
import { getWorkspaceOwner } from "@/lib/current-user"

export const dynamic = "force-dynamic"

export default async function Page() {
  const owner = await getWorkspaceOwner()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Uji Coba WhatsApp</h1>
        <p className="text-sm text-muted-foreground">Kirim pesan test dan lihat balasan WA masuk secara langsung.</p>
      </div>
      <WaTestPanel phoneNumber={owner.phoneNumber ?? ""} />
    </div>
  )
}
