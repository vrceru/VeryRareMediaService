"use client";

import { motion } from "framer-motion";

export default function SubscriptionSummary() {
  return (
    <motion.section
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.8,
      }}
      className="mx-auto w-full max-w-2xl text-center"
    >

      <h2 className="text-3xl font-semibold tracking-tight">
        Your Subscription
      </h2>


      <p className="mt-4 text-neutral-400">
        Customize your entertainment experience and view
        your estimated monthly cost.
      </p>


      <div
        className="
          mt-8
          rounded-3xl
          border
          border-white/10
          bg-white/[0.04]
          p-8
          backdrop-blur-xl
        "
      >

        <div className="space-y-4 text-left">

          <div className="flex justify-between text-neutral-300">
            <span>Movies</span>
            <span>Included</span>
          </div>

          <div className="flex justify-between text-neutral-300">
            <span>TV Shows</span>
            <span>Included</span>
          </div>

          <div className="flex justify-between text-neutral-300">
            <span>Anime</span>
            <span>Included</span>
          </div>

          <div className="flex justify-between text-neutral-300">
            <span>Music</span>
            <span>Included</span>
          </div>

        </div>


        <div className="mt-8 border-t border-white/10 pt-6">

          <p className="text-sm text-neutral-500">
            Estimated Monthly Total
          </p>

          <p className="mt-2 text-5xl font-semibold">
            $14.99
          </p>

        </div>

      </div>

    </motion.section>
  );
}
