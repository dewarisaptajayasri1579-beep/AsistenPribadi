import type Anthropic from "@anthropic-ai/sdk"

import { formatJakartaTime, jakartaRangeFromToday, jakartaTodayDateIso, jakartaTodayRange, parseJakartaDateIso } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"
import { materializeOccurrences, RECURRING_HORIZON_WEEKS } from "@/lib/recurring-schedule"
import { getStockPrice } from "@/lib/stock-price"

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "create_task",
    description:
      "Membuat tugas baru untuk direktur. Kalau tugas kemungkinan butuh lebih dari 1 hari untuk dikerjakan, WAJIB tanyakan dulu tanggal mulai (startDate) sebelum memanggil tool ini — jangan asumsikan mulai hari ini.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Judul tugas" },
        description: { type: "string", description: "Catatan tambahan" },
        startDate: { type: "string", description: "Tanggal mulai dikerjakan, format ISO 8601 (YYYY-MM-DD)" },
        dueDate: { type: "string", description: "Tanggal jatuh tempo/selesai, format ISO 8601 (YYYY-MM-DD atau dengan waktu)" },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        category: { type: "string", description: "Kategori tugas, misal: klien, internal, pembayaran" },
      },
      required: ["title"],
    },
  },
  {
    name: "update_task",
    description: "Mengubah data tugas yang sudah ada.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        startDate: { type: "string" },
        dueDate: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        status: { type: "string", enum: ["todo", "in_progress", "done", "postponed"] },
        category: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "complete_task",
    description: "Menandai tugas sebagai selesai.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "create_schedule",
    description:
      "Membuat jadwal/meeting baru. Sudah otomatis memeriksa bentrok secara internal — jika bentrok, TIDAK membuat jadwal dan hasilnya berisi hasConflict:true beserta daftar konfliknya. Tidak perlu panggil check_schedule_conflict sebelum ini.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        startAt: { type: "string", description: "Waktu mulai, ISO 8601 dengan offset +07:00" },
        endAt: { type: "string", description: "Waktu selesai, ISO 8601 (opsional, default 1 jam setelah mulai)" },
        location: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title", "startAt"],
    },
  },
  {
    name: "create_recurring_schedule",
    description:
      "Membuat jadwal RUTIN/berulang mingguan (mis. 'tiap Senin & Kamis jam 9'). Otomatis bikin kejadian nyata untuk 12 minggu ke depan (terus di-top-up mingguan supaya tidak pernah habis) — jangan panggil create_schedule berkali-kali manual untuk pola berulang.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        weekdays: {
          type: "array",
          items: { type: "integer", minimum: 1, maximum: 7 },
          description: "Hari dalam seminggu: 1=Senin, 2=Selasa, 3=Rabu, 4=Kamis, 5=Jumat, 6=Sabtu, 7=Minggu",
        },
        startTime: { type: "string", description: "Jam mulai, format HH:mm (Asia/Jakarta), mis. '09:00'" },
        endTime: { type: "string", description: "Jam selesai, format HH:mm, opsional (default 1 jam setelah mulai)" },
        location: { type: "string" },
        notes: { type: "string" },
        startDate: { type: "string", description: "Mulai berlaku dari tanggal ini, format YYYY-MM-DD, default hari ini" },
      },
      required: ["title", "weekdays", "startTime"],
    },
  },
  {
    name: "get_recurring_schedules",
    description: "Melihat daftar jadwal rutin/berulang yang masih aktif, termasuk ID-nya (dibutuhkan sebelum stop_recurring_schedule).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "stop_recurring_schedule",
    description:
      "Menghentikan rangkaian jadwal rutin — kejadian yang sudah lewat tetap ada di riwayat, tapi kejadian mendatang yang belum lewat akan dihapus. Cari ID-nya lewat get_recurring_schedules dulu kalau belum tahu. Hanya panggil setelah pengguna menyetujui secara eksplisit.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "delete_schedule",
    description: "Menghapus jadwal/meeting. Hanya panggil setelah pengguna menyetujui secara eksplisit (mis. 'ya hapus saja').",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Menghapus tugas. Hanya panggil setelah pengguna menyetujui secara eksplisit (mis. 'ya hapus saja').",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "check_schedule_conflict",
    description:
      "Memeriksa apakah rentang waktu tertentu bentrok dengan jadwal yang sudah ada, TANPA membuat jadwal. Hanya untuk pertanyaan eksplisit seperti 'apakah jam segini bentrok?' — jangan panggil ini sebelum create_schedule, karena create_schedule sudah cek sendiri.",
    input_schema: {
      type: "object",
      properties: {
        startAt: { type: "string", description: "ISO 8601 dengan offset +07:00" },
        endAt: { type: "string", description: "ISO 8601, opsional (default 1 jam setelah mulai)" },
      },
      required: ["startAt"],
    },
  },
  {
    name: "get_today_tasks",
    description: "Mengambil daftar tugas dan jadwal untuk hari ini.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_overdue_tasks",
    description: "Mengambil daftar tugas yang sudah melewati deadline dan belum selesai.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_upcoming_agenda",
    description:
      "Mengambil jadwal & tugas (belum selesai) dalam rentang N hari ke depan mulai hari ini — pakai ini untuk pertanyaan seperti 'minggu depan ada apa', 'agenda 3 hari ke depan', dsb. Jangan pakai get_today_tasks untuk pertanyaan rentang tanggal.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Jumlah hari ke depan dari hari ini, default 7, maksimal 30" },
      },
    },
  },
  {
    name: "create_follow_up",
    description:
      "Membuat catatan follow-up terhadap klien/rekan/tim. Kalau pengguna belum tahu/belum pasti tanggalnya, biarkan dueDate kosong (JANGAN menebak) — follow-up tanpa dueDate tetap otomatis diingatkan tiap briefing sampai ada kepastian.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        relatedPerson: { type: "string" },
        dueDate: { type: "string", description: "Opsional — kosongkan kalau tanggalnya belum pasti." },
        notes: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "get_follow_ups",
    description:
      "Mengambil daftar follow-up yang masih terbuka (belum selesai), termasuk ID-nya. Panggil ini kalau pengguna menyebut nama orang/topik (mis. \"Ridwan sudah selesai\", \"follow-up ke Pak Agus gimana\") supaya tahu follow-up mana yang dimaksud sebelum menandainya selesai — jangan menebak ID.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "complete_follow_up",
    description: "Menandai follow-up sebagai selesai. Cari ID-nya dulu lewat get_follow_ups kalau belum tahu.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "generate_daily_brief",
    description: "Membuat ringkasan briefing harian: agenda hari ini, prioritas, dan follow-up yang terlambat.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_pending_schedule_checkins",
    description:
      "Mengambil daftar jadwal yang sudah dikirimi pesan check-in (\"sudah selesai belum?\") tapi belum ditindaklanjuti. Panggil ini kalau pengguna membalas singkat seperti 'sudah'/'belum'/'udah selesai' tanpa konteks lain yang jelas, supaya tahu jadwal mana yang dimaksud.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "complete_schedule",
    description:
      "Menandai jadwal sebagai selesai ditindaklanjuti (dipanggil baik saat pengguna bilang 'sudah' maupun 'belum' terhadap check-in jadwal — supaya tidak ditanyakan berulang).",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "get_stock_price",
    description: "Cek harga saham IDX terkini (Yahoo Finance, delay ~15-20 menit). Pakai untuk pertanyaan bebas seperti 'harga BBCA sekarang berapa?' — tidak perlu saham itu sedang dipantau.",
    input_schema: {
      type: "object",
      properties: { ticker: { type: "string", description: "Kode saham IDX, mis. BBCA, TLKM (tanpa .JK)" } },
      required: ["ticker"],
    },
  },
  {
    name: "create_stock_watch",
    description:
      "Mulai memantau saham IDX — kirim WA otomatis kalau harga capai target jual. WAJIB isi minimal salah satu: targetPrice (harga tetap) ATAU (buyPrice + targetPercent, persentase untung dari harga beli). Kalau pengguna belum sebutkan kriterianya, tanya dulu — jangan menebak angka.",
    input_schema: {
      type: "object",
      properties: {
        ticker: { type: "string", description: "Kode saham IDX, mis. BBCA (tanpa .JK)" },
        targetPrice: { type: "number", description: "Jual kalau harga tembus angka ini" },
        buyPrice: { type: "number", description: "Harga beli/modal, dipakai bareng targetPercent" },
        targetPercent: { type: "number", description: "Jual kalau untung sekian persen dari buyPrice" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_stock_watches",
    description: "Mengambil daftar saham yang sedang dipantau beserta harga terakhir & kriteria jualnya, termasuk ID-nya (dibutuhkan sebelum stop_stock_watch).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "stop_stock_watch",
    description: "Berhenti memantau satu saham (mis. karena sudah dijual manual). Cari ID-nya dulu lewat get_stock_watches kalau belum tahu.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "record_transaction",
    description:
      "Mencatat SATU pemasukan/pengeluaran. Dipakai baik untuk perintah teks biasa (mis. 'keluar 20rb parkir') MAUPUN hasil baca foto nota/struk — kalau pengguna kirim foto nota, ekstrak nominal TOTAL akhir (bukan subtotal), tanggal transaksi (kalau tidak kelihatan di nota, pakai waktu sekarang), nama toko/keterangan, dan kategori (mis. makan, transportasi, belanja, tagihan) dari isi nota, lalu panggil tool ini. Kalau nominal atau jenisnya (pemasukan/pengeluaran) tidak jelas dari teks maupun foto, tanya dulu ke pengguna — jangan menebak.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"], description: "income = pemasukan, expense = pengeluaran" },
        amount: { type: "number", description: "Nominal transaksi (Rupiah, tanpa titik/koma pemisah)" },
        category: { type: "string", description: "Kategori, mis. makan, transportasi, belanja, gaji, tagihan" },
        description: { type: "string", description: "Keterangan singkat, mis. nama toko atau alasan" },
        occurredAt: { type: "string", description: "Tanggal/waktu transaksi, ISO 8601. Kosongkan untuk pakai waktu sekarang." },
      },
      required: ["type", "amount"],
    },
  },
  {
    name: "get_transactions",
    description:
      "Mengambil riwayat transaksi (pemasukan/pengeluaran), termasuk ID-nya (dibutuhkan sebelum delete_transaction) dan ringkasan total. Pakai untuk pertanyaan seperti 'pengeluaran bulan ini berapa', 'catatan keuangan hari ini apa saja'.",
    input_schema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Rentang N hari terakhir dari hari ini, default 30, maksimal 365" },
      },
    },
  },
  {
    name: "delete_transaction",
    description: "Menghapus satu catatan transaksi (mis. salah catat). Cari ID-nya dulu lewat get_transactions kalau belum tahu.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
]

type ToolContext = { userId: string }

async function createTask(ctx: ToolContext, input: any) {
  const task = await prisma.task.create({
    data: {
      userId: ctx.userId,
      title: input.title,
      description: input.description,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      priority: input.priority ?? "normal",
      category: input.category,
    },
  })
  return task
}

async function updateTask(ctx: ToolContext, input: any) {
  const task = await prisma.task.update({
    where: { id: input.id, userId: ctx.userId },
    data: {
      title: input.title,
      description: input.description,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      priority: input.priority,
      status: input.status,
      category: input.category,
    },
  })
  return task
}

async function completeTask(ctx: ToolContext, input: any) {
  const task = await prisma.task.update({
    where: { id: input.id, userId: ctx.userId },
    data: { status: "done", completedAt: new Date() },
  })
  return task
}

async function deleteSchedule(ctx: ToolContext, input: any) {
  await prisma.schedule.delete({ where: { id: input.id, userId: ctx.userId } })
  return { deleted: true }
}

async function deleteTask(ctx: ToolContext, input: any) {
  await prisma.task.delete({ where: { id: input.id, userId: ctx.userId } })
  return { deleted: true }
}

function resolveEnd(startAt: string, endAt?: string) {
  return endAt ? new Date(endAt) : new Date(new Date(startAt).getTime() + 60 * 60 * 1000)
}

async function checkScheduleConflict(ctx: ToolContext, input: any) {
  const start = new Date(input.startAt)
  const end = resolveEnd(input.startAt, input.endAt)

  const overlapping = await prisma.schedule.findMany({
    where: {
      userId: ctx.userId,
      status: { not: "cancelled" },
      startAt: { lt: end },
      OR: [{ endAt: { gt: start } }, { endAt: null, startAt: { gt: start } }, { endAt: null }],
    },
  })

  const conflicts = overlapping.filter((s) => {
    const sEnd = s.endAt ?? new Date(s.startAt.getTime() + 60 * 60 * 1000)
    return s.startAt < end && sEnd > start
  })

  return { hasConflict: conflicts.length > 0, conflicts: withScheduleLabels(conflicts) }
}

async function createSchedule(ctx: ToolContext, input: any) {
  const conflictCheck = await checkScheduleConflict(ctx, input)
  if (conflictCheck.hasConflict) {
    return { created: false, ...conflictCheck }
  }

  const schedule = await prisma.schedule.create({
    data: {
      userId: ctx.userId,
      title: input.title,
      startAt: new Date(input.startAt),
      endAt: input.endAt ? new Date(input.endAt) : resolveEnd(input.startAt, input.endAt),
      location: input.location,
      notes: input.notes,
    },
  })
  // startAt/endAt di objek schedule tersimpan UTC (offset Z) — field label ini sudah dikonversi
  // ke WIB, supaya AI mengutip ini ke pengguna alih-alih menghitung sendiri dari ISO mentah.
  return {
    created: true,
    schedule,
    startAtLabel: `${formatJakartaTime(schedule.startAt)} WIB`,
    endAtLabel: `${formatJakartaTime(schedule.endAt!)} WIB`,
  }
}

async function createRecurringSchedule(ctx: ToolContext, input: any) {
  const weekdays: number[] = Array.isArray(input.weekdays) ? input.weekdays : []
  if (weekdays.length === 0) throw new Error("weekdays wajib diisi minimal 1 hari")

  const startDateIso = input.startDate || jakartaTodayDateIso()
  const horizonUntil = new Date(
    parseJakartaDateIso(startDateIso).getTime() + RECURRING_HORIZON_WEEKS * 7 * 24 * 60 * 60 * 1000
  )

  const recurring = await prisma.recurringSchedule.create({
    data: {
      userId: ctx.userId,
      title: input.title,
      weekdays,
      startTime: input.startTime,
      endTime: input.endTime,
      location: input.location,
      notes: input.notes,
      horizonUntil,
    },
  })

  const { created, skipped } = await materializeOccurrences(ctx.userId, recurring, startDateIso, horizonUntil)

  return { recurringScheduleId: recurring.id, createdCount: created.length, skippedDates: skipped }
}

async function getRecurringSchedules(ctx: ToolContext) {
  const recurringSchedules = await prisma.recurringSchedule.findMany({ where: { userId: ctx.userId, active: true } })
  return { recurringSchedules }
}

async function stopRecurringSchedule(ctx: ToolContext, input: any) {
  await prisma.recurringSchedule.update({
    where: { id: input.id, userId: ctx.userId },
    data: { active: false },
  })
  const deleted = await prisma.schedule.deleteMany({
    where: { recurrenceId: input.id, userId: ctx.userId, startAt: { gt: new Date() } },
  })
  return { stopped: true, deletedUpcomingCount: deleted.count }
}

/** Tambah field label WIB per jadwal — field startAt/endAt aslinya UTC (offset Z), AI sering
 *  salah sebut jam mentah itu ke pengguna kalau tidak dikasih versi yang sudah diformat. */
function withScheduleLabels<T extends { startAt: Date; endAt: Date | null }>(schedules: T[]) {
  return schedules.map((s) => ({
    ...s,
    startAtLabel: `${formatJakartaTime(s.startAt)} WIB`,
    endAtLabel: s.endAt ? `${formatJakartaTime(s.endAt)} WIB` : null,
  }))
}

async function getTodayTasks(ctx: ToolContext) {
  const { start, end } = jakartaTodayRange()
  const [tasks, schedules] = await Promise.all([
    prisma.task.findMany({
      where: { userId: ctx.userId, dueDate: { gte: start, lt: end } },
      orderBy: { priority: "desc" },
    }),
    prisma.schedule.findMany({
      where: { userId: ctx.userId, startAt: { gte: start, lt: end } },
      orderBy: { startAt: "asc" },
    }),
  ])
  return { tasks, schedules: withScheduleLabels(schedules) }
}

async function getOverdueTasks(ctx: ToolContext) {
  const { start } = jakartaTodayRange()
  const tasks = await prisma.task.findMany({
    where: {
      userId: ctx.userId,
      status: { notIn: ["done"] },
      dueDate: { lt: start },
    },
    orderBy: { dueDate: "asc" },
  })
  return { tasks }
}

async function getUpcomingAgenda(ctx: ToolContext, input: any) {
  const days = typeof input?.days === "number" && input.days > 0 ? Math.min(Math.floor(input.days), 30) : 7
  const { start, end } = jakartaRangeFromToday(days)

  const [schedules, tasks] = await Promise.all([
    prisma.schedule.findMany({
      where: { userId: ctx.userId, status: { not: "cancelled" }, startAt: { gte: start, lt: end } },
      orderBy: { startAt: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: ctx.userId, status: { notIn: ["done"] }, dueDate: { gte: start, lt: end } },
      orderBy: { dueDate: "asc" },
    }),
  ])

  return { rangeDays: days, schedules: withScheduleLabels(schedules), tasks }
}

async function createFollowUp(ctx: ToolContext, input: any) {
  const followUp = await prisma.followUp.create({
    data: {
      userId: ctx.userId,
      title: input.title,
      relatedPerson: input.relatedPerson,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      notes: input.notes,
    },
  })
  return followUp
}

async function getFollowUps(ctx: ToolContext) {
  const followUps = await prisma.followUp.findMany({
    where: { userId: ctx.userId, status: "open" },
    orderBy: { dueDate: "asc" },
  })
  return { followUps }
}

async function completeFollowUp(ctx: ToolContext, input: any) {
  const followUp = await prisma.followUp.update({
    where: { id: input.id, userId: ctx.userId },
    data: { status: "done" },
  })
  return followUp
}

async function getPendingScheduleCheckins(ctx: ToolContext) {
  const pending = await prisma.schedule.findMany({
    where: { userId: ctx.userId, checkinAt: { not: null }, status: { notIn: ["cancelled", "done"] } },
    orderBy: { checkinAt: "desc" },
  })
  return { pending: withScheduleLabels(pending) }
}

async function completeSchedule(ctx: ToolContext, input: any) {
  const schedule = await prisma.schedule.update({
    where: { id: input.id, userId: ctx.userId },
    data: { status: "done" },
  })
  return schedule
}

async function generateDailyBrief(ctx: ToolContext) {
  const { start } = jakartaTodayRange()
  const [{ tasks, schedules }, highPriorityTasks, overdueFollowUps] = await Promise.all([
    getTodayTasks(ctx),
    prisma.task.findMany({
      where: { userId: ctx.userId, priority: "high", status: { notIn: ["done"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.followUp.findMany({
      where: { userId: ctx.userId, status: "open", dueDate: { lt: start } },
    }),
  ])

  return { agenda: schedules, tasksToday: tasks, highPriorityTasks, overdueFollowUps }
}

async function getStockPriceTool(_ctx: ToolContext, input: any) {
  return getStockPrice(input.ticker)
}

async function createStockWatch(ctx: ToolContext, input: any) {
  if (input.targetPrice == null && (input.buyPrice == null || input.targetPercent == null)) {
    throw new Error("Wajib isi targetPrice, ATAU buyPrice+targetPercent, sebagai kriteria jual")
  }

  // Validasi ticker beneran ada dengan fetch harganya — jangan simpan ticker ngawur.
  const quote = await getStockPrice(input.ticker)

  const watch = await prisma.stockWatch.create({
    data: {
      userId: ctx.userId,
      ticker: quote.ticker.replace(/\.JK$/, ""),
      companyName: quote.companyName,
      targetPrice: input.targetPrice,
      buyPrice: input.buyPrice,
      targetPercent: input.targetPercent,
    },
  })
  return { watch, currentPrice: quote.price }
}

async function getStockWatches(ctx: ToolContext) {
  const watches = await prisma.stockWatch.findMany({
    where: { userId: ctx.userId, active: true },
    include: { priceLogs: { orderBy: { checkedAt: "desc" }, take: 1 } },
  })
  return { watches }
}

async function stopStockWatch(ctx: ToolContext, input: any) {
  const watch = await prisma.stockWatch.update({
    where: { id: input.id, userId: ctx.userId },
    data: { active: false },
  })
  return watch
}

async function recordTransaction(ctx: ToolContext, input: any) {
  if (input.type !== "income" && input.type !== "expense") {
    throw new Error("type wajib 'income' atau 'expense'")
  }
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount wajib angka lebih dari 0")
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId: ctx.userId,
      type: input.type,
      amount,
      category: input.category,
      description: input.description,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      source: "whatsapp",
    },
  })
  return { transaction }
}

async function getTransactions(ctx: ToolContext, input: any) {
  const days = typeof input?.days === "number" && input.days > 0 ? Math.min(Math.floor(input.days), 365) : 30
  const { start: todayStart } = jakartaTodayRange()
  const start = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000)

  const transactions = await prisma.transaction.findMany({
    where: { userId: ctx.userId, occurredAt: { gte: start } },
    orderBy: { occurredAt: "desc" },
  })

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)

  return { rangeDays: days, transactions, totalIncome, totalExpense, balance: totalIncome - totalExpense }
}

async function deleteTransaction(ctx: ToolContext, input: any) {
  await prisma.transaction.delete({ where: { id: input.id, userId: ctx.userId } })
  return { deleted: true }
}

export async function runTool(name: string, input: any, ctx: ToolContext) {
  switch (name) {
    case "create_task":
      return createTask(ctx, input)
    case "update_task":
      return updateTask(ctx, input)
    case "complete_task":
      return completeTask(ctx, input)
    case "create_schedule":
      return createSchedule(ctx, input)
    case "create_recurring_schedule":
      return createRecurringSchedule(ctx, input)
    case "get_recurring_schedules":
      return getRecurringSchedules(ctx)
    case "stop_recurring_schedule":
      return stopRecurringSchedule(ctx, input)
    case "delete_schedule":
      return deleteSchedule(ctx, input)
    case "delete_task":
      return deleteTask(ctx, input)
    case "check_schedule_conflict":
      return checkScheduleConflict(ctx, input)
    case "get_today_tasks":
      return getTodayTasks(ctx)
    case "get_overdue_tasks":
      return getOverdueTasks(ctx)
    case "get_upcoming_agenda":
      return getUpcomingAgenda(ctx, input)
    case "create_follow_up":
      return createFollowUp(ctx, input)
    case "get_follow_ups":
      return getFollowUps(ctx)
    case "complete_follow_up":
      return completeFollowUp(ctx, input)
    case "generate_daily_brief":
      return generateDailyBrief(ctx)
    case "get_pending_schedule_checkins":
      return getPendingScheduleCheckins(ctx)
    case "complete_schedule":
      return completeSchedule(ctx, input)
    case "get_stock_price":
      return getStockPriceTool(ctx, input)
    case "create_stock_watch":
      return createStockWatch(ctx, input)
    case "get_stock_watches":
      return getStockWatches(ctx)
    case "stop_stock_watch":
      return stopStockWatch(ctx, input)
    case "record_transaction":
      return recordTransaction(ctx, input)
    case "get_transactions":
      return getTransactions(ctx, input)
    case "delete_transaction":
      return deleteTransaction(ctx, input)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
