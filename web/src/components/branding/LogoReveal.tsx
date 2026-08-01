"use client";

import { motion } from "framer-motion";
import BrandLogo from "./BrandLogo";

export default function LogoReveal() {
  return (
    <motion.div
      initial={{
        opacity: 0.15,
        scale: 0.98,
        filter: "brightness(0.6)",
      }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: "brightness(1)",
      }}
      transition={{
        duration: 4,
        delay: 0.5,
        ease: "easeInOut",
      }}
    >
      <BrandLogo />
    </motion.div>
  );
}
