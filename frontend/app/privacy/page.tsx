import { Brain } from "lucide-react";
import Link from "next/link";
import Footer from "@/components/Footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#080a0c] text-neutral-300 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto space-y-12 py-16 px-4 flex-1">
        <header className="space-y-4">
          <Link href="/" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors">
            <Brain className="h-5 w-5" />
            <span className="font-bold tracking-tight text-white">Hyperfi</span>
          </Link>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Privacy Policy</h1>
          <p className="text-neutral-500">Last updated: July 2026</p>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">1. Information We Collect</h2>
          <p>
            When you use Hyperfi, we collect basic account information through our authentication provider (Clerk), including your email address and profile details. If you upgrade to a premium plan, your payment information is securely processed by Stripe. We do not store full credit card numbers on our servers.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">2. How We Use Your Data</h2>
          <p>
            The text and documents you upload to generate audio are processed temporarily to create your focus tracks. Once the audio is generated, we do not use your text data for training models or any other purpose. Your generated audio tracks are stored securely so you can access them from your library.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">3. Third-Party Services</h2>
          <p>
            We use ElevenLabs for text-to-speech generation. Text you submit for audio generation is sent to ElevenLabs solely for the purpose of generating the audio. Please refer to ElevenLabs' privacy policy for more details on how they handle text inputs.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">4. Data Deletion</h2>
          <p>
            You can delete your account and all associated data at any time from your account settings. This will immediately remove your audio tracks, uploaded text, and account details from our primary servers.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">5. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at support@hyperfi.app.
          </p>
        </section>
      </div>
      <Footer />
    </div>
  );
}
