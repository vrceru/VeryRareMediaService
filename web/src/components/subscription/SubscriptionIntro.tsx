"use client";

import { motion } from "framer-motion";

export default function SubscriptionIntro() {
  return (
    <motion.div
      initial={{
        opacity: 0,
        x: -30,
      }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      transition={{
        duration: 0.8,
      }}
      className="max-w-xl"
    >

      <h2
        className="
          text-3xl
          font-semibold
          tracking-tight
          leading-tight
          text-white
        "
      >
        A growing platform built around discovery,
        choice, and a personalized entertainment
        experience.
      </h2>


      <p
        className="
          mt-6
          text-neutral-400
          leading-relaxed
        "
      >
        Our library continues to expand with new movies,
        shows, anime, and music added regularly. If we
        don't currently have what you're looking for,
        you can submit a request and help shape the
        future of VeryRare Media.
      </p>

    </motion.div>
  );
}
