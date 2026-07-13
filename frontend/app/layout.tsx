import type { Metadata } from "next";
import "./globals.css";
import { Outfit } from "next/font/google";
import { cn } from "@/lib/utils";
import { ClerkProvider } from "@clerk/nextjs";
import Footer from "@/components/Footer";

const outfit = Outfit({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "FocusReader — ADHD Text to Speech",
  description: "Turn boring PDFs and textbooks into dopamine-optimized audio tracks.",
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
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
