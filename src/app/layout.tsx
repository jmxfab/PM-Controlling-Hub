import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { MainNav } from "@/components/nav/main-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AiChatPanel } from "@/components/chat/ai-chat-panel";

export const metadata: Metadata = {
  title: {
    default: "JMX Controlling Hub",
    template: "%s | JMX Controlling Hub",
  },
  description:
    "Controlling Dashboard für PV, Wärmepumpen und Haustechnik mit Hero- und Supabase-Anbindung.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: ["/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Ambient backdrop layer — sits behind everything, never blocks clicks */}
          <div
            aria-hidden
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
          >
            <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 h-[720px] w-[1200px] rounded-full bg-gradient-to-br from-blue-300/20 via-violet-300/15 to-transparent dark:from-blue-500/10 dark:via-violet-500/8 blur-3xl" />
            <div className="absolute bottom-[-30%] right-[-10%] h-[600px] w-[800px] rounded-full bg-gradient-to-tl from-amber-300/10 via-rose-300/8 to-transparent dark:from-amber-500/6 dark:via-rose-500/5 blur-3xl" />
          </div>
          <MainNav />
          <main className="animate-page-in">{children}</main>
          <AiChatPanel />
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
