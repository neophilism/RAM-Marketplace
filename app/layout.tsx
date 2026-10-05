import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAM Marketplace",
  description: "Naturally occurring disease models for biomedical research."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><Nav /><main>{children}</main></body></html>;
}
