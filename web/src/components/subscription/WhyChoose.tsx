export default function WhyChoose() {
  const cards = [
    {
      title: (
        <>
          Your Media,
          <br />
          Your Way
        </>
      ),
      text:
        "Enjoy your entertainment wherever you are. Your VeryRare Media experience is designed around flexibility, allowing you to access your content across your devices without unnecessary restrictions.",
    },

    {
      title: (
        <>
          Affordable
          <br />
          Entertainment
        </>
      ),
      text:
        "Entertainment should be accessible for everyone. Choose the experience that fits your needs without unnecessary costs or restrictions.",
    },

    {
      title: (
        <>
          Community
          <br />
          Powered
        </>
      ),
      text:
        "VeryRare Media is built alongside its community. Every membership includes monthly VR Tokens, giving you the opportunity to do more than just watch—you can help shape the future of the platform.",
    },

    {
      title: (
        <>
          Ways to Earn More
          <br />
          VR Tokens
        </>
      ),
      rewards: [
        "Referring friends",
        "Helpful feedback",
        "Reporting bugs",
        "Community events",
        "Continued membership",
      ],
    },
  ];

  return (
    <section className="mx-auto w-full py-20">

      <div className="mx-auto max-w-3xl text-center">

        <h2 className="text-4xl font-semibold tracking-tight text-white">
          Why Choose VeryRare Media
        </h2>

        <p className="mt-5 text-white/60">
          Built around affordability, flexibility, and a community-first
          entertainment experience.
        </p>

      </div>


      <div
        className="
          mx-auto
          mt-14
          grid
          max-w-5xl
          grid-cols-1
          gap-6
          md:grid-cols-2
        "
      >

        {cards.map((card, index) => (

          <div
            key={index}
            className="
              flex
              h-[300px]
              flex-col
              rounded-3xl
              border
              border-white/10
              bg-white/[0.04]
              p-8
              backdrop-blur-xl
            "
          >

            <h3
              className="
                text-3xl
                font-semibold
                leading-tight
                text-white
              "
            >
              {card.title}
            </h3>


            <div
              className="
                mt-6
                h-px
                w-14
                bg-white/20
              "
            />


            {card.text && (
              <p
                className="
                  mt-6
                  text-sm
                  leading-7
                  text-white/65
                "
              >
                {card.text}
              </p>
            )}


            {card.rewards && (
              <ul
                className="
                  mt-6
                  space-y-3
                  text-sm
                  text-white/65
                "
              >
                {card.rewards.map((reward) => (
                  <li key={reward}>
                    ✓ {reward}
                  </li>
                ))}
              </ul>
            )}

          </div>

        ))}

      </div>

    </section>
  );
}
