"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import BrandLogo from "@/components/branding/BrandLogo";
import AmbientBackground from "@/effects/AmbientBackground";
import LogoReveal from "@/components/branding/LogoReveal";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">

      <AmbientBackground />
      
      {/* Main content */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1 }}
        className="relative z-10 flex w-full max-w-5xl flex-col items-center px-6 text-center"
      >

        {/* VRSM Branding */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1 }}
          className="mb-12"
        >
        <LogoReveal />
        </motion.div>


        {/* Welcome text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 5, duration: 1.5 }}
          className="mb-10 max-w-xl text-lg text-neutral-400"
        >
          Your premium media experience powered by Very Rare Society.
        </motion.p>


        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 7, duration: 1 }}
          className="flex flex-col gap-4 sm:flex-row"
        >

          <Link
            href="/signin"
            className="rounded-full border border-white/20 bg-white px-10 py-4 font-semibold text-black transition hover:scale-105"
          >
            Sign In
          </Link>


          <Link
            href="/signup"
            className="rounded-full border border-white/30 bg-white/10 px-10 py-4 font-semibold text-white backdrop-blur-md transition hover:scale-105 hover:bg-white/20"
          >
            Sign Up
          </Link>

        </motion.div>

      </motion.section>

    </main>
  );
}
