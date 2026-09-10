import { prisma } from "../lib/prisma"

/** Bikin session cookie untuk sebuah email — dipakai skrip uji supaya bisa memanggil API sebagai
 *  user tertentu tanpa perlu tahu password-nya. */
async function main() {
  const email = process.argv[2]
  const user = await prisma.user.findUniqueOrThrow({ where: { email } })
  const session = await prisma.session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  })
  console.log(session.id)
}

main().then(() => process.exit(0))
