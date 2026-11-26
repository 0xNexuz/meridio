import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource/bungee-outline";
import "./globals.css";

import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Meridio: class money that only moves at pickup",
  description:
    "Pool money for textbooks and class items. Each student's share is paid to the vendor only when they collect, and refunded if they don't.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5f0e7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-8 pt-6">{children}</main>
          <footer className="mx-auto w-full max-w-3xl px-5 py-6 text-xs text-muted">
            Running on Solana devnet with test USDC. Nothing here is real money.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
