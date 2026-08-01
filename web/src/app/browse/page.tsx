import Sidebar from "@/components/media/browse/Sidebar";
import Header from "@/components/media/browse/Header";

export default function BrowsePage() {
  return (
    <main
      className="
        min-h-screen
        bg-black
        text-white
      "
    >

      <Sidebar />

      <Header />


      <section
        className="
          ml-64
          pt-24
          px-10
        "
      >

        <div
          className="
            flex
            min-h-[600px]
            items-center
            justify-center
            rounded-2xl
            border
            border-white/10
            text-white/40
          "
        >
          VRSM Home Coming Soon
        </div>

      </section>

    </main>
  );
}
