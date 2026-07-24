export type AgendaItem = {
  time: string
  title: string
  location: string
}

export type PriorityLevel = "Tinggi" | "Sedang"

export type PriorityItem = {
  title: string
  description: string
  level: PriorityLevel
}

export const weekDays = [
  { label: "Sen", date: 21 },
  { label: "Sel", date: 22 },
  { label: "Rab", date: 23 },
  { label: "Kam", date: 24 },
  { label: "Jum", date: 25 },
  { label: "Sab", date: 26 },
  { label: "Min", date: 27 },
]

export const quickActions = [
  "Ringkasan Minggu Ini",
  "Tugas utama yang belum selesai",
  "Ingatkan saya follow-up Yamada-san",
]
