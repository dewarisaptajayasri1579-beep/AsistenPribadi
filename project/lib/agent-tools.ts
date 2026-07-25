import type Anthropic from "@anthropic-ai/sdk"

import { jakartaTodayRange } from "@/lib/datetime"
import { prisma } from "@/lib/prisma"

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
    name: "create_follow_up",
    description: "Membuat catatan follow-up terhadap klien/rekan/tim.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        relatedPerson: { type: "string" },
        dueDate: { type: "string" },
        notes: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "generate_daily_brief",
    description: "Membuat ringkasan briefing harian: agenda hari ini, prioritas, dan follow-up yang terlambat.",
    input_schema: { type: "object", properties: {} },
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

  return { hasConflict: conflicts.length > 0, conflicts }
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
  return { created: true, schedule }
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
  return { tasks, schedules }
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
    case "create_follow_up":
      return createFollowUp(ctx, input)
    case "generate_daily_brief":
      return generateDailyBrief(ctx)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
