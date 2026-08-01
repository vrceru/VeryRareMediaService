"use client";

import { motion } from "framer-motion";

export default function LogoShimmer() {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20"
      animate={{
        backgroundPosition: ["200% center", "-200% center"],
      }}
      transition={{
        duration: 6,
        repeat: Infinity,
        repeatDelay: 10,
        ease: "easeInOut",
      }}
      style={{
        background:
          "linear-gradient(110deg, transparent 40%, rgba(255,255,255,0.45) 50%, transparent 60%)",
        backgroundSize: "250% 100%",
        WebkitMaskImage:
          "url('/branding/vrsm-banner-dark-trans.png')",
        maskImage:
          "url('/branding/vrsm-banner-dark-trans.png')",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}
