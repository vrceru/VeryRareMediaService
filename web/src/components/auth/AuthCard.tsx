"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface AuthCardProps {
  children: ReactNode;
}

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 25,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.8,
        delay: 1,
        ease: "easeOut",
      }}
      className="
        w-full
        rounded-3xl
        border
        border-white/10
        bg-white/[0.04]
        p-8
        backdrop-blur-xl
        shadow-2xl
      "
    >
      {children}
    </motion.div>
  );
}
