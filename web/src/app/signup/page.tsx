"use client";

import Link from "next/link";
import AuthLayout from "@/components/auth/AuthLayout";
import AuthCard from "@/components/auth/AuthCard";
import AuthInput from "@/components/auth/AuthInput";
import AuthButton from "@/components/auth/AuthButton";

export default function SignupPage() {
  return (
    <AuthLayout>
      <AuthCard>

        <div className="mb-8 text-center">

          <h1 className="text-3xl font-semibold">
            Create your account
          </h1>

          <p className="mt-3 text-sm text-neutral-400">
            To begin your premium streaming experience.
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
            placeholder="Create a password"
          />


          <AuthInput
            label="Confirm Password"
            type="password"
            placeholder="Confirm your password"
          />


          <div className="pt-4">
            <AuthButton type="submit">
              Continue
            </AuthButton>
          </div>

        </div>


        <p className="mt-8 text-center text-sm text-neutral-400">

          Already have an account?{" "}

          <Link
            href="/signin"
            className="text-white hover:underline"
          >
            Sign In
          </Link>

        </p>


      </AuthCard>
    </AuthLayout>
  );
}
