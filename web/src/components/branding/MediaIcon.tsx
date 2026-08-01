import Image from "next/image";

export default function MediaIcon() {
  return (
    <div
      className="
        flex
        h-20
        w-20
        items-center
        justify-center
      "
    >
      <Image
        src="/branding/vrm-favicon-dark.png"
        alt="VeryRare Media"
        width={96}
        height={96}
        className="
          h-20
          w-20
          object-contain
        "
        priority
      />
    </div>
  );
}
