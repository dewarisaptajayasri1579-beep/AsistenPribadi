import { getAllWorkspaceOwners, getWorkspaceOwnerFor } from "../lib/current-user"
import { prisma } from "../lib/prisma"

function check(label: string, ok: boolean) {
  console.log(`${ok ? "✅" : "❌"} ${label}`)
  if (!ok) process.exitCode = 1
}

async function main() {
  const created: string[] = []

  // Direktur kedua + sekretarisnya + satu akun yang belum disetujui.
  const budi = await prisma.user.create({
    data: { name: "TEST Budi", email: "test-budi@example.invalid", phoneNumber: "081000000001", approvedAt: new Date() },
  })
  const sekretaris = await prisma.user.create({
    data: { name: "TEST Sekretaris Budi", email: "test-sek@example.invalid", ownerId: budi.id, approvedAt: new Date() },
  })
  const pending = await prisma.user.create({
    data: { name: "TEST Pending", email: "test-pending@example.invalid", phoneNumber: "081000000002" },
  })
  created.push(sekretaris.id, budi.id, pending.id)

  try {
    const ony = await prisma.user.findFirstOrThrow({ where: { isOwner: true } })

    check("direktur -> workspace dirinya sendiri", (await getWorkspaceOwnerFor(budi)).id === budi.id)
    check("sekretaris -> workspace direkturnya", (await getWorkspaceOwnerFor(sekretaris)).id === budi.id)
    check("direktur lain tidak tertarik ke workspace Ony", (await getWorkspaceOwnerFor(budi)).id !== ony.id)

    const owners = await getAllWorkspaceOwners()
    check("cron melihat kedua direktur", owners.some((o) => o.id === ony.id) && owners.some((o) => o.id === budi.id))
    check("cron TIDAK melihat sekretaris", !owners.some((o) => o.id === sekretaris.id))
    check("cron TIDAK melihat akun belum disetujui", !owners.some((o) => o.id === pending.id))

    // Tugas milik Budi tidak boleh terbaca dari workspace Ony.
    const task = await prisma.task.create({ data: { userId: budi.id, title: "TEST tugas rahasia Budi" } })
    const onyTasks = await prisma.task.findMany({ where: { userId: ony.id } })
    check("tugas Budi tidak muncul di workspace Ony", !onyTasks.some((t) => t.id === task.id))
    await prisma.task.delete({ where: { id: task.id } })

    // Persis filter yang dipakai findRegisteredSender di whatsapp-webhook.ts.
    const reachable = await prisma.user.findMany({ where: { phoneNumber: { not: null }, approvedAt: { not: null } } })
    check("Naya bisa balas direktur yang sudah disetujui", reachable.some((u) => u.id === budi.id))
    check("Naya membisu ke akun belum disetujui", !reachable.some((u) => u.id === pending.id))
  } finally {
    for (const id of created) await prisma.user.delete({ where: { id } })
    console.log("\n(data uji dibersihkan)")
  }
}

main().then(() => process.exit(process.exitCode ?? 0))
