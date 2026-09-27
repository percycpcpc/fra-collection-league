import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FRA Collection League",
  description: "Track Reality Fracture collections and build decks with friends.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
