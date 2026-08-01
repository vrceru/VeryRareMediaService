"use client";

import Image from "next/image";
import LogoShimmer from "./LogoShimmer";

export default function LogoGlow() {
  return (
    <div className="relative flex items-center justify-center overflow-hidden">

      {/* Letter glow layer */}
      <Image
        src="/branding/vrsm-banner-dark-trans.png"
        alt=""
        width={700}
        height={250}
        priority
        aria-hidden="true"
        className="
          absolute
          h-auto
          w-[min(90vw,900px)]
          object-contain
          opacity-50
          blur-xl
        "
      />

      {/* Sharp logo */}
      <Image
        src="/branding/vrsm-banner-dark-trans.png"
        alt="VeryRare Media by Very Rare Society"
        width={700}
        height={250}
        priority
        className="
          relative
          z-10
          h-auto
          w-[min(90vw,900px)]
          object-contain
        "
      />

      {/* Metallic reflection */}
      <LogoShimmer />

    </div>
  );
}
