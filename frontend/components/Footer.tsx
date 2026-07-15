import { Headphones, BookOpen, Mail } from "lucide-react";
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
                <Headphones className="h-3 w-3 text-white" />
              </div>
              <span className="font-extrabold tracking-tight text-white antialiased text-lg">FocusReader</span>
            </Link>
            <p className="text-sm text-neutral-300 font-medium leading-relaxed antialiased">
              A calm reading-to-audio companion for students, ADHD minds, and anyone who focuses better by listening.
            </p>
          </div>

          {/* Policy */}
          <div className="space-y-4">
            <h4 className="font-bold text-white antialiased text-base tracking-tight">Product</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/#pricing" className="text-neutral-400 hover:text-white transition-colors font-medium">Pricing</Link></li>
              <li><Link href="/dashboard" className="text-neutral-400 hover:text-white transition-colors font-medium">Focus Document Studio</Link></li>
              <li><Link href="/privacy" className="text-neutral-400 hover:text-white transition-colors font-medium">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-neutral-400 hover:text-white transition-colors font-medium">Terms of Service</Link></li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-white antialiased text-base tracking-tight">Resources</h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/blog" className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium">
                  <BookOpen className="h-4 w-4" /> Blog
                </Link>
              </li>
              <li>
                <Link href="/contact" className="group flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium">
                  <Mail className="h-4 w-4" /> Contact
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-white antialiased text-base tracking-tight">Trust</h4>
            <ul className="space-y-2.5 text-sm text-neutral-400">
              <li>Your documents stay private.</li>
              <li>You control playback and motion.</li>
              <li>Delete your content when you choose.</li>
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
