import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "MediCast | Intelligent Hospital Resource Framework",
  description: "Forecast ICU/ward beds, ED arrivals, staff demand and equipment use.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-(--bg) transition-colors duration-150">
                {children}
              </main>
              <footer className="p-4 text-center text-xs text-(--text-muted) border-t border-(--border)">
                Simulated data. Decision support only, a human makes the final call.
              </footer>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
