import type { Metadata } from "next";
import "./globals.css";
import { Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";

const outfit = Outfit({ subsets: ['latin'], variable: '--font-sans' });

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
      <html lang="en" className={cn("dark", "font-sans", outfit.variable)}>
        <body className="min-h-screen bg-[#0b0d10] text-neutral-100 antialiased selection:bg-indigo-500/30 flex flex-col">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
