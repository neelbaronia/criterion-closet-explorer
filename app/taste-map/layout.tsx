import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Taste Map — The Closet Index",
  description:
    "Explore quantified cinematic taste dimensions and similarity between Criterion Closet pickers.",
};

export default function TasteMapLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
