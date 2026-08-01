"use client";

import { motion } from "framer-motion";

const categories = [
  "Movies",
  "TV Shows",
  "Anime",
  "Music",
  "Live TV",
];

export default function MediaCarousel() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.4 }}
      className="w-full text-center"
    >
      <h2 className="text-3xl font-semibold tracking-tight">
        Build Your Subscription
      </h2>

      <p className="mx-auto mt-5 max-w-2xl text-neutral-400 leading-relaxed">
        Craft a streaming experience tailored to your interests.
        Choose the entertainment you love, and pay only for what
        you enjoy.
      </p>

      <div className="mt-12 flex justify-center gap-6 overflow-hidden">

        {categories.map((category) => (
          <div
            key={category}
            className="
              flex
              h-56
              w-44
              items-center
              justify-center
              rounded-3xl
              border
              border-white/10
              bg-white/[0.03]
              backdrop-blur-xl
              transition-all
              duration-300
              hover:border-white/20
              hover:bg-white/[0.05]
              hover:scale-105
            "
          >
            <span className="text-lg font-medium text-neutral-300">
              {category}
            </span>
          </div>
        ))}

      </div>
    </motion.section>
  );
}
