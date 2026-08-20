import type { RatingLabel } from "@/types/scoring";

/**
 * Score-to-rating bands. This is presentation logic only (labels/colors) —
 * the scoring engine (Stage 3) is the sole source of the numeric score.
 * Bands are descriptive, not investment recommendations.
 */
const RATING_BANDS: { min: number; rating: RatingLabel }[] = [
  { min: 90, rating: "Exceptional" },
  { min: 75, rating: "Strong" },
  { min: 60, rating: "Moderate" },
  { min: 40, rating: "Weak" },
  { min: 0, rating: "High Risk" },
];

export function getRatingFromScore(overall: number): RatingLabel {
  const band = RATING_BANDS.find((b) => overall >= b.min);
  return band ? band.rating : "High Risk";
}

interface RatingStyle {
  label: string;
  /** Short tagline shown next to the score, e.g. "STRONG FUNDAMENTALS". */
  tagline: string;
  text: string;
  bg: string;
  border: string;
}

const RATING_STYLES: Record<RatingLabel, RatingStyle> = {
  Exceptional: {
    label: "Exceptional",
    tagline: "EXCEPTIONAL FUNDAMENTALS",
    text: "var(--rating-exceptional)",
    bg: "var(--rating-exceptional-bg)",
    border: "var(--rating-exceptional)",
  },
  Strong: {
    label: "Strong",
    tagline: "STRONG FUNDAMENTALS",
    text: "var(--rating-strong)",
    bg: "var(--rating-strong-bg)",
    border: "var(--rating-strong)",
  },
  Moderate: {
    label: "Moderate",
    tagline: "MODERATE FUNDAMENTALS",
    text: "var(--rating-moderate)",
    bg: "var(--rating-moderate-bg)",
    border: "var(--rating-moderate)",
  },
  Weak: {
    label: "Weak",
    tagline: "WEAK FUNDAMENTALS",
    text: "var(--rating-weak)",
    bg: "var(--rating-weak-bg)",
    border: "var(--rating-weak)",
  },
  "High Risk": {
    label: "High Risk",
    tagline: "HIGH RISK",
    text: "var(--rating-high-risk)",
    bg: "var(--rating-high-risk-bg)",
    border: "var(--rating-high-risk)",
  },
};

export function getRatingStyle(rating: RatingLabel): RatingStyle {
  return RATING_STYLES[rating];
}
