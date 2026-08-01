"use client";

const mainLinks = [
  "Home",
  "Live Now",
  "Movies",
  "Shows",
  "Anime",
  "Songs",
  "Games",
];

const userLinks = [
  "Watchlist",
  "Requests",
  "Downloads",
];

export default function Sidebar() {
  return (
    <aside
      className="
        fixed
        left-0
        top-20
        z-40
        h-[calc(100vh-5rem)]
        w-64
        border-r
        border-white/10
        bg-black
        px-6
        py-8
        text-white
      "
    >
      <nav className="flex h-full flex-col justify-between">

        <div className="space-y-2">

          {mainLinks.map((item) => (
            <button
              key={item}
              className="
                w-full
                rounded-lg
                px-4
                py-3
                text-left
                text-sm
                text-white/70
                transition
                hover:bg-white/5
                hover:text-white
              "
            >
              {item}
            </button>
          ))}


          <div className="my-6 h-px bg-white/10" />


          {userLinks.map((item) => (
            <button
              key={item}
              className="
                w-full
                rounded-lg
                px-4
                py-3
                text-left
                text-sm
                text-white/70
                hover:bg-white/5
                hover:text-white
              "
            >
              {item}
            </button>
          ))}


          <div className="my-6 h-px bg-white/10" />


          <button
            className="
              w-full
              rounded-lg
              px-4
              py-3
              text-left
              text-sm
              text-white/70
              hover:bg-white/5
              hover:text-white
            "
          >
            Admin
          </button>

        </div>


        <button
          className="
            w-full
            rounded-lg
            px-4
            py-3
            text-left
            text-sm
            text-white/70
            hover:bg-white/5
            hover:text-white
          "
        >
          Settings
        </button>

      </nav>
    </aside>
  );
}
