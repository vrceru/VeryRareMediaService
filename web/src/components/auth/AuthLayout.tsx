"use client";

import { ReactNode } from "react";
import AmbientBackground from "@/effects/AmbientBackground";
import LogoReveal from "@/components/branding/LogoReveal";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">

      {/* Background */}
      <AmbientBackground />

      {/* Content */}
      <section className="relative z-10 flex w-full max-w-md flex-col items-center px-6">

        {/* Logo */}
        <div className="mb-2">
          <LogoReveal />
        </div>

        {/* Auth Content */}
        {children}

      </section>

    </main>
  );
}
