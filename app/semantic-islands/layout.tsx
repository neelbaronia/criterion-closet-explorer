import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "3D Semantic Islands — The Closet Index",
  description:
    "Navigate a three-dimensional map of the films chosen in Criterion Closet Picks.",
};

export default function SemanticIslandsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
