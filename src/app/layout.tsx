import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "JMX Controlling Hub",
    template: "%s | JMX Controlling Hub",
  },
  description:
    "Controlling Dashboard für PV, Wärmepumpen und Haustechnik mit Hero- und Supabase-Anbindung.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
