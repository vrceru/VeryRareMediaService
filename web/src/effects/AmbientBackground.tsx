"use client";

import { motion } from "framer-motion";

export default function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-black">

      {/* Deep glass base */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-br
          from-neutral-950
          via-black
          to-neutral-950
        "
      />

      {/* Soft cinematic light */}
      <motion.div
        className="
          absolute
          left-1/2
          top-1/2
          h-[900px]
          w-[900px]
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          bg-gradient-to-r
          from-white/[0.04]
          via-white/[0.08]
          to-transparent
          blur-[160px]
        "
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.35, 0.55, 0.35],
          rotate: [0, 45, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Secondary glass reflection */}
      <motion.div
        className="
          absolute
          -left-40
          top-1/3
          h-[500px]
          w-[500px]
          rounded-full
          bg-slate-300/[0.025]
          blur-[140px]
        "
        animate={{
          x: [0, 80, 0],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Glass vignette */}
      <div
        className="
          absolute
          inset-0
          bg-gradient-to-b
          from-transparent
          via-transparent
          to-black/70
        "
      />

      {/* Subtle film grain */}
      <div
        className="
          absolute
          inset-0
          opacity-[0.035]
          mix-blend-soft-light
          bg-[url('/noise.png')]
        "
      />

    </div>
  );
}
