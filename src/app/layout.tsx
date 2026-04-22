import type { Metadata } from "next";
import "./globals.css";
import { MainNav } from "@/components/nav/main-nav";
import { Toaster } from "@/components/ui/sonner";

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
    <html lang="de">
      <body className="antialiased">
        <MainNav />
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
