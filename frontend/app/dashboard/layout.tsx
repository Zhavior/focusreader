"use client";

import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Wrench, CreditCard, Star } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#0b0d10] flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0b0d10]/80 backdrop-blur-md">
        <div className="flex h-16 items-center px-4 sm:px-8 max-w-7xl mx-auto w-full justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <span className="text-white font-bold text-lg leading-none tracking-tighter">Z</span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight hidden sm:block">Zhavior</span>
            </Link>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1 sm:gap-2 absolute left-1/2 -translate-x-1/2">
            <Link href="/dashboard" className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all ${
              pathname === "/dashboard" 
                ? "bg-white/10 text-white" 
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}>
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Studio</span>
            </Link>

            <Link href="/dashboard/tools" className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all ${
              pathname.includes("/dashboard/tools")
                ? "bg-indigo-500/10 text-indigo-300" 
                : "text-neutral-400 hover:text-indigo-300 hover:bg-indigo-500/5"
            }`}>
              <Wrench className="w-4 h-4" />
              <span>Tools</span>
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            </Link>

            <Link href="/dashboard/billing" className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all ${
              pathname.includes("/dashboard/billing")
                ? "bg-white/10 text-white" 
                : "text-neutral-400 hover:text-white hover:bg-white/5"
            }`}>
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Billing</span>
            </Link>
          </nav>

          {/* User Button */}
          <div className="flex items-center gap-4">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-9 h-9" } }} />
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
