import { Brain, Twitter, Instagram, MessageSquare, BookOpen, Mail } from "lucide-react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative mt-auto border-t border-white/10 bg-gradient-to-b from-[#080a0c] to-white/10 overflow-hidden">
      {/* Decorative sharp gradient fade at the very bottom */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-50"></div>
      
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-16 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          
          {/* Brand */}
          <div className="space-y-4 col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_14px_rgba(99,102,241,0.6)]">
                <Brain className="h-3 w-3 text-white" />
              </div>
              <span className="font-extrabold tracking-tight text-white antialiased text-lg">FocusReader</span>
            </Link>
            <p className="text-sm text-neutral-300 font-medium leading-relaxed antialiased">
              Neuro-inclusive audio generation. Designed to help you stop drifting and start finishing.
            </p>
          </div>

          {/* Policy */}
          <div className="space-y-4">
            <h4 className="font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 antialiased text-lg tracking-tight">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacy" className="text-neutral-400 hover:text-white transition-colors font-semibold antialiased tracking-wide">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-neutral-400 hover:text-white transition-colors font-semibold antialiased tracking-wide">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Socials */}
          <div className="space-y-4">
            <h4 className="font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 antialiased text-lg tracking-tight">Socials</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-semibold antialiased tracking-wide">
                  <Twitter className="h-4 w-4 group-hover:text-sky-400 transition-colors" /> X (Twitter)
                </a>
              </li>
              <li>
                <a href="#" className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-semibold antialiased tracking-wide">
                  <Instagram className="h-4 w-4 group-hover:text-pink-500 transition-colors" /> Instagram
                </a>
              </li>
              <li>
                <a href="#" className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-semibold antialiased tracking-wide">
                  <MessageSquare className="h-4 w-4 group-hover:text-indigo-400 transition-colors" /> Discord
                </a>
              </li>
            </ul>
          </div>

          {/* Connect */}
          <div className="space-y-4">
            <h4 className="font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 antialiased text-lg tracking-tight">Connect</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-semibold antialiased tracking-wide">
                  <BookOpen className="h-4 w-4 group-hover:text-emerald-400 transition-colors" /> Blog
                </a>
              </li>
              <li>
                <Link href="/contact" className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-semibold antialiased tracking-wide">
                  <Mail className="h-4 w-4 group-hover:text-amber-400 transition-colors" /> Contact Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-500 font-semibold antialiased tracking-wide">
            © {new Date().getFullYear()} FocusReader. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
