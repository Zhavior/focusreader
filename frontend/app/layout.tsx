import type { Metadata } from "next";
import "./globals.css";
import { Inter_Tight, Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FocusReader — Turn Dense Reading Into Audio",
  description: "Turn PDFs, articles, and textbooks into calm, focused audio sessions designed to help you finish what you start.",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={cn("dark", "font-sans", outfit.variable, interTight.variable)}>
        <body className="min-h-screen bg-[#0b0d10] text-neutral-100 antialiased selection:bg-indigo-500/30 flex flex-col">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
