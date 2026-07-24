import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Director Daily Assistant",
  description:
    "Dashboard harian untuk agenda, prioritas, tugas, dan rekomendasi AI direktur.",
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0b1630",
  width: "device-width",
  initialScale: 1,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className="bg-background">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-w-0 bg-background font-sans antialiased`}
      >
        <TooltipProvider>{children}</TooltipProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
