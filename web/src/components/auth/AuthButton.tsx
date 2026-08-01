"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface AuthButtonProps {
  children: ReactNode;
  type?: "button" | "submit";
}

export default function AuthButton({
  children,
  type = "button",
}: AuthButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={{
        scale: 1.03,
      }}
      whileTap={{
        scale: 0.98,
      }}
      className="
        h-12
        w-full
        rounded-xl
        bg-white
        font-semibold
        text-black
        transition
        hover:bg-neutral-200
      "
    >
      {children}
    </motion.button>
  );
}
