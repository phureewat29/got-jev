import type { Metadata } from "next";
import { Cinzel, EB_Garamond } from "next/font/google";
import "./globals.css";
import { assetUrl } from "@/cdn";

const display = Cinzel({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const TITLE = "Game of Thrones x Jev";
const DESCRIPTION =
  "A Game of Thrones roleplay where you play Jon Snow. A story model writes each scene; TypeSafe's Jev labels where you are, what kind of scene it was, and what should play under it.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://jev.phureewat.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: assetUrl("/og.jpg"), width: 1200, height: 630, alt: TITLE }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [assetUrl("/og.jpg")] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
