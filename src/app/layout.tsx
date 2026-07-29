import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "Trade FX",
  description: "Realtime forex, crypto, and metals trading platform in USD",
  applicationName: "Trade FX",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Trade FX",
  },
  icons: {
    icon: "/app-icon.svg",
    apple: "/app-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#070a11",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[radial-gradient(circle_at_top,#182036_0%,#070a11_45%)]"
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
