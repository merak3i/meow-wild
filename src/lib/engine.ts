import { CATS, SUMMIT_M } from "./cats";
import { IUCN_META } from "./format";

export interface JourneyStats {
  total: number;
  /** Near Threatened or worse */
  atRisk: number;
  /** Vulnerable, Endangered or Critically Endangered */
  threatened: number;
  highest: number;
}

export function deriveStats(): JourneyStats {
  return {
    total: CATS.length,
    atRisk: CATS.filter((c) => IUCN_META[c.iucn].atRisk).length,
    threatened: CATS.filter((c) => IUCN_META[c.iucn].threatened).length,
    highest: SUMMIT_M,
  };
}
