"use client";

import BrandLogo from "@/components/branding/BrandLogo";

import SubscriptionIntro from "@/components/subscription/SubscriptionIntro";
import LibraryStats from "@/components/subscription/LibraryStats";
import WhyChoose from "@/components/subscription/WhyChoose";
import MediaCarousel from "@/components/subscription/MediaCarousel";
import SubscriptionSummary from "@/components/subscription/SubscriptionSummary";
import GuaranteeSection from "@/components/subscription/GuaranteeSection";

export default function SubscriptionPage() {
  return (
    <main
      className="
        relative
        min-h-screen
        w-full
        overflow-hidden
        bg-black
        text-white
        px-6
        py-16
      "
    >

      {/* Ambient Background */}
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_45%)]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          right-0
          top-1/3
          h-[500px]
          w-[500px]
          rounded-full
          bg-blue-500/10
          blur-[120px]
        "
      />


      <div
        className="
          relative
          mx-auto
          flex
          w-full
          max-w-7xl
          flex-col
          items-center
        "
      >

        {/* Logo */}
        <section
          className="
            w-full
            max-w-3xl
            text-center
          "
        >
          <BrandLogo />
        </section>


        {/* Divider */}
        <div
          className="
            my-12
            h-px
            w-full
            bg-white/10
          "
        />


        {/* Intro + Stats Centered Layout */}
        <section
          className="
            flex
            w-full
            max-w-6xl
            flex-col
            items-center
            justify-center
            gap-12
            md:flex-row
            md:gap-16
          "
        >

          {/* Intro */}
          <div
            className="
              w-full
              max-w-xl
              text-center
            "
          >
            <SubscriptionIntro />
          </div>


          {/* Stats */}
          <div
            className="
              w-full
              max-w-xl
              flex
              justify-center
            "
          >
            <LibraryStats />
          </div>

        </section>


        {/* Divider */}
        <div
          className="
            my-16
            h-px
            w-full
            bg-white/10
          "
        />


        {/* Why Choose */}
        <section className="w-full">
          <WhyChoose />
        </section>


        {/* Divider */}
        <div
          className="
            my-16
            h-px
            w-full
            bg-white/10
          "
        />


        {/* Media Carousel */}
        <section className="w-full">

          <MediaCarousel />

        </section>


        {/* Subscription Summary */}
        <section
          className="
            mt-20
            w-full
          "
        >
          <SubscriptionSummary />
        </section>


        {/* Guarantee */}
        <section
          className="
            mt-20
            w-full
          "
        >
          <GuaranteeSection />
        </section>


      </div>

    </main>
  );
}
