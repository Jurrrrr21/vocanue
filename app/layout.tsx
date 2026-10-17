import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vocanue",
  description: "AI receptionist for Australian service businesses.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-AU"><body>{children}</body></html>;
}
