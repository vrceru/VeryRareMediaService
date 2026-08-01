export default function LibraryStats() {
  const stats = [
    {
      label: "Songs",
      value: "0",
    },
    {
      label: "Movies",
      value: "0",
    },
    {
      label: "Shows",
      value: "0",
    },
    {
      label: "Anime",
      value: "0",
    },
    {
      label: "Games",
      value: "0",
    },
  ];

  return (
    <section className="w-full">
      <div
        className="
          mx-auto
          w-full
          max-w-md
          rounded-3xl
          border
          border-white/10
          bg-white/[0.04]
          p-8
          backdrop-blur-xl
        "
      >

        {stats.map((stat, index) => (
          <div key={stat.label}>

            <div
              className="
                flex
                items-center
                justify-between
                py-5
              "
            >

              <span
                className="
                  text-lg
                  font-medium
                  text-white/80
                "
              >
                {stat.label}
              </span>


              <span
                className="
                  text-3xl
                  font-semibold
                  tracking-tight
                  text-white
                "
              >
                {stat.value}
              </span>

            </div>


            {index !== stats.length - 1 && (
              <div
                className="
                  h-px
                  w-full
                  bg-white/10
                "
              />
            )}

          </div>
        ))}

      </div>
    </section>
  );
}
