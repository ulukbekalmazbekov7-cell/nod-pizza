"use client";

import { useEffect, useState } from "react";

export type EnergyWebMode = "full" | "lite" | "static";

export type EnergyWebCapabilities = {
  mode: EnergyWebMode;
  prefersReducedMotion: boolean;
  isCoarsePointer: boolean;
  isNarrowViewport: boolean;
};

const MOBILE_QUERY = "(max-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

function readCapabilities(): EnergyWebCapabilities {
  if (typeof window === "undefined") {
    return {
      mode: "full",
      prefersReducedMotion: false,
      isCoarsePointer: false,
      isNarrowViewport: false,
    };
  }

  const prefersReducedMotion = window.matchMedia(REDUCED_MOTION_QUERY).matches;
  const isCoarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches;
  const isNarrowViewport = window.matchMedia(MOBILE_QUERY).matches;

  let mode: EnergyWebMode = "full";
  if (prefersReducedMotion) {
    mode = "static";
  } else if (isCoarsePointer || isNarrowViewport) {
    mode = "lite";
  }

  return {
    mode,
    prefersReducedMotion,
    isCoarsePointer,
    isNarrowViewport,
  };
}

export function useEnergyWebCapabilities(): EnergyWebCapabilities {
  const [capabilities, setCapabilities] = useState<EnergyWebCapabilities>(() => ({
    mode: "full",
    prefersReducedMotion: false,
    isCoarsePointer: false,
    isNarrowViewport: false,
  }));

  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY);
    const reduced = window.matchMedia(REDUCED_MOTION_QUERY);
    const coarse = window.matchMedia(COARSE_POINTER_QUERY);

    const refresh = () => setCapabilities(readCapabilities());

    mobile.addEventListener("change", refresh);
    reduced.addEventListener("change", refresh);
    coarse.addEventListener("change", refresh);

    refresh();

    return () => {
      mobile.removeEventListener("change", refresh);
      reduced.removeEventListener("change", refresh);
      coarse.removeEventListener("change", refresh);
    };
  }, []);

  return capabilities;
}
