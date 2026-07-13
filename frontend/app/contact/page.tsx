"use client";

import { useState } from "react";
import { Brain, Send, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      email: formData.get("email"),
      subject: formData.get("subject"),
      message: formData.get("message"),
      _template: "box", // FormSubmit optional: makes the email look nice
    };

    try {
      await fetch("https://formsubmit.co/ajax/zhavior@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });
      setIsSuccess(true);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080a0c] text-neutral-300 py-16 px-4">
      <div className="max-w-2xl mx-auto space-y-12">
        <header className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors">
            <Brain className="h-5 w-5" />
            <span className="font-bold tracking-tight text-white">FocusReader</span>
          </Link>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Contact Us</h1>
          <p className="text-neutral-500">
            Have a question, feedback, or need help? Send us a message and we'll get back to you as soon as possible.
          </p>
        </header>

        {isSuccess ? (
          <div className="relative mx-auto max-w-lg mt-12 animate-in fade-in zoom-in duration-1000">
            {/* Glowing rainbow background that pulses */}
            <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-rose-500 via-fuchsia-500 via-indigo-500 to-teal-500 opacity-70 blur-xl animate-pulse" />
            
            <div className="relative bg-[#0b0d10] border border-white/10 rounded-3xl p-12 text-center space-y-6 shadow-2xl">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-center bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-fuchsia-400 via-indigo-400 to-teal-400">
                Thank you for choosing us
              </h2>
              <p className="text-lg text-neutral-300 font-medium leading-relaxed">
                We will get back to you within 2-5 business days.
              </p>
              <div className="pt-4">
                <Button
                  onClick={() => setIsSuccess(false)}
                  className="bg-white/5 hover:bg-white/10 text-white rounded-full px-6 font-semibold transition-all border border-white/10"
                >
                  Send another message
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-neutral-200">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="Your name"
                  className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-neutral-200">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium text-neutral-200">
                Subject
              </label>
              <select
                id="subject"
                name="subject"
                required
                defaultValue=""
                className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all appearance-none cursor-pointer"
              >
                <option value="" disabled hidden>Select a topic...</option>
                <option value="ideas" className="bg-[#111318] text-white">Ideas & Feature Requests</option>
                <option value="bugs" className="bg-[#111318] text-white">Report a Bug</option>
                <option value="complaints" className="bg-[#111318] text-white">Complaints / Issues</option>
                <option value="other" className="bg-[#111318] text-white">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-neutral-200">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={5}
                placeholder="How can we help?"
                className="w-full bg-[#111318] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                "Sending..."
              ) : (
                <>
                  Send Message
                  <Send className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
