"use client";

import { HeroUIProvider } from "@heroui/react";
import FloatingProgressOverlay from "@/components/FloatingProgressOverlay";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HeroUIProvider>
      {children}
      <FloatingProgressOverlay />
    </HeroUIProvider>
  );
}
