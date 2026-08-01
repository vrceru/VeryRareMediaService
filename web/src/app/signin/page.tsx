"use client";

import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import AuthButton from "@/components/auth/AuthButton";

export default function SigninPage() {
  return (
    <AuthLayout>
      <AuthCard>

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold">
            Welcome back
          </h1>

          <p className="mt-3 text-sm text-neutral-400">
            Continue your premium streaming experience.
          </p>
        </div>


        <div className="flex flex-col gap-5">

          <AuthInput
            label="Email Address"
            type="email"
            placeholder="Enter your email"
          />


          <AuthInput
            label="Password"
            type="password"
            placeholder="Enter your password"
          />


          <div className="flex items-center justify-between text-sm text-neutral-400">

            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="accent-white"
              />
              Remember this device
            </label>


            <button className="text-white hover:underline">
              Forgot password?
            </button>

          </div>


          <div className="pt-4">
            <AuthButton type="submit">
              Continue
            </AuthButton>
          </div>

        </div>


        <p className="mt-8 text-center text-sm text-neutral-400">
          Don't have an account?{" "}

          <Link
            href="/signup"
            className="text-white hover:underline"
          >
            Sign Up
          </Link>

        </p>


      </AuthCard>
    </AuthLayout>
  );
}
