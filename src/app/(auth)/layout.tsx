import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Access your Clausly contract intelligence workspace.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
