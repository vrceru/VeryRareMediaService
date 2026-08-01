"use client";

import { motion } from "framer-motion";

export default function GuaranteeSection() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6 }}
      className="w-full text-center"
    >
      <div className="mx-auto max-w-3xl">

        <h3 className="text-2xl font-semibold tracking-tight">
          Your subscription evolves with you.
        </h3>

        <p className="mt-4 text-neutral-400 leading-relaxed">
          Add, refine, or adjust your experience whenever you choose.
        </p>

        <div className="mt-10 border-t border-white/10 pt-10">

          <h4 className="text-xl font-medium">
            14-Day Satisfaction Guarantee
          </h4>

          <p className="mx-auto mt-4 max-w-2xl text-neutral-400 leading-relaxed">
            Experience VeryRare Media with confidence. If it isn't the
            right fit, request a refund within 14 days.
          </p>

        </div>

        <button
          className="
            mt-12
            rounded-2xl
            border
            border-white/10
            bg-white/[0.05]
            px-12
            py-4
            text-lg
            font-medium
            transition-all
            duration-300
            hover:border-white/20
            hover:bg-white/[0.08]
          "
        >
          Continue
        </button>

      </div>
    </motion.section>
  );
}
