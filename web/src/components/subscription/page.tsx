import WhyChoose from "@/components/subscription/WhyChoose";
import LibraryStats from "@/components/subscription/LibraryStats";
import MediaCarousel from "@/components/subscription/MediaCarousel";
import BundleCarousel from "@/components/subscription/BundleCarousel";
import Guarantee from "@/components/subscription/Guarantee";
import BrandLogo from "@/components/BrandLogo";

export default function SubscriptionPage() {
  return (
    <main
      className="
        relative
        min-h-screen
        overflow-hidden
        bg-black
        text-white
      "
    >

      {/* Ambient Background */}
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          -z-10
          bg-[radial-gradient(circle_at_top,rgba(120,80,255,0.18),transparent_40%)]
        "
      />

      <div
        className="
          pointer-events-none
          absolute
          inset-0
          -z-10
          bg-[radial-gradient(circle_at_bottom_right,rgba(0,150,255,0.12),transparent_45%)]
        "
      />


      {/* Header */}
      <section
        className="
          mx-auto
          flex
          max-w-7xl
          flex-col
          items-center
          px-6
          pt-20
          text-center
        "
      >

        <BrandLogo />

        <div className="mt-10 h-px w-40 bg-white/20" />


        <h1
          className="
            mt-12
            max-w-5xl
            text-5xl
            font-semibold
            tracking-tight
            md:text-7xl
          "
        >
          A growing platform built around discovery,
          choice, and a personalized entertainment experience.
        </h1>


        <p
          className="
            mt-8
            max-w-3xl
            text-lg
            leading-8
            text-white/65
          "
        >
          Explore entertainment your way with flexible access,
          community-powered requests, and a library that continues
          to grow every day.
        </p>


        <div className="mt-12 h-px w-full max-w-5xl bg-white/10" />

      </section>



      {/* Library */}
      <section className="mx-auto max-w-7xl px-6">

        <LibraryStats />

      </section>



      {/* Why Choose */}
      <section className="mx-auto max-w-7xl px-6">

        <WhyChoose />

      </section>



      {/* Subscription Builder */}
      <section className="mx-auto max-w-7xl px-6">

        <div className="my-12 h-px bg-white/10" />

        <h2
          className="
            text-center
            text-5xl
            font-semibold
            tracking-tight
          "
        >
          Build Your Experience
        </h2>


        <p
          className="
            mx-auto
            mt-5
            max-w-2xl
            text-center
            text-white/60
          "
        >
          Choose what fits you. Select individual services
          or save more with a bundle.
        </p>


        <MediaCarousel />

        <BundleCarousel />


      </section>



      {/* Guarantee */}
      <section className="mx-auto max-w-7xl px-6">

        <Guarantee />

      </section>



      {/* Footer Placeholder */}
      <footer
        className="
          mx-auto
          mt-20
          max-w-7xl
          border-t
          border-white/10
          px-6
          py-12
          text-center
          text-white/50
        "
      >

        VeryRare Media

      </footer>


    </main>
  );
}
