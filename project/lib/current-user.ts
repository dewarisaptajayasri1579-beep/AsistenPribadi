import { prisma } from "@/lib/prisma"

export async function getCurrentUser() {
  const user = await prisma.user.findFirstOrThrow()
  return user
}
