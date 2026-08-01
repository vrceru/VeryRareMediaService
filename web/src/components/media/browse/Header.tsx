"use client";

import MediaIcon from "@/components/branding/MediaIcon";

export default function Header() {
  return (
    <header
      className="
        fixed
        left-0
        top-0
        z-50
        flex
        h-24
        w-full
        items-center
        gap-6
        border-b
        border-white/10
        bg-black/70
        px-8
        backdrop-blur-xl
      "
    >

      {/* Menu Button */}
      <button
        className="
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
          border
          border-white/10
          text-xl
          text-white/70
          transition
          hover:bg-white/5
          hover:text-white
        "
      >
        ☰
      </button>


      {/* VRM Logo */}
      <div
        className="
          flex
          h-24
          w-28
          shrink-0
          items-center
          justify-center
        "
      >
        <MediaIcon />
      </div>


      {/* Search */}
      <div
        className="
          flex
          flex-1
          justify-center
        "
      >
        <div
          className="
            flex
            w-full
            max-w-xl
            items-center
            gap-3
            rounded-full
            border
            border-white/10
            bg-white/5
            px-5
            py-3
            text-white/50
            backdrop-blur-xl
            transition
            hover:border-white/20
            hover:bg-white/10
          "
        >
          <span className="text-white/40">
            /
          </span>

          <span className="text-sm text-white/50">
            Search movies, shows, anime, songs...
          </span>

        </div>
      </div>


      {/* Profile */}
      <button
        className="
          rounded-full
          border
          border-white/10
          bg-white/5
          px-5
          py-2.5
          text-sm
          text-white/70
          backdrop-blur-xl
          transition
          hover:bg-white/10
          hover:text-white
        "
      >
        Profile
      </button>

    </header>
  );
}
