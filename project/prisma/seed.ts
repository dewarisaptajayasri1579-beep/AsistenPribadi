import { prisma } from "@/lib/prisma"

/**
 * Menandai (atau membuat) satu user sebagai workspace owner — pemilik data
 * jadwal/tugas/follow-up bersama. Aman dijalankan berulang kali.
 */
async function main() {
  const existingOwner = await prisma.user.findFirst({ where: { isOwner: true } })
  if (existingOwner) {
    console.log("Workspace owner sudah ada:", existingOwner.email)
    return
  }

  const user = await prisma.user.upsert({
    where: { email: "onysaptanugraha@gmail.com" },
    update: { isOwner: true },
    create: {
      name: "onyseven",
      email: "onysaptanugraha@gmail.com",
      timezone: "Asia/Jakarta",
      isOwner: true,
    },
  })

  console.log("Workspace owner:", user.email)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
