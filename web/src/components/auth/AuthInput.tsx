"use client";

interface AuthInputProps {
  label: string;
  type?: string;
  placeholder?: string;
}

export default function AuthInput({
  label,
  type = "text",
  placeholder,
}: AuthInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-neutral-300">
        {label}
      </label>

      <input
        type={type}
        placeholder={placeholder}
        className="
          h-12
          w-full
          rounded-xl
          border
          border-white/10
          bg-black/40
          px-4
          text-white
          placeholder:text-neutral-500
          outline-none
          transition
          focus:border-white/30
          focus:bg-black/60
        "
      />
    </div>
  );
}
