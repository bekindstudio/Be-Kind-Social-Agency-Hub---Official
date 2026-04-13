import type { SocialPlatform } from "@/types/client";

interface PlatformIconProps {
  platform: SocialPlatform;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: 14,
  md: 18,
  lg: 22,
} as const;

export function PlatformIcon({ platform, size = "md" }: PlatformIconProps) {
  const px = sizeMap[size];
  const common = { width: px, height: px, viewBox: "0 0 24 24", fill: "none" as const, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  switch (platform) {
    case "instagram":
      return (
        <svg {...common} stroke="#7C3AED">
          <rect x="4" y="4" width="16" height="16" rx="5" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="17" cy="7" r="1" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common} stroke="#2563EB">
          <circle cx="12" cy="12" r="9" />
          <path d="M13 7.5h1.5M11.5 16.5v-9h3" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common} stroke="#0EA5E9">
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <path d="M8.5 10.5v5M8.5 8.2h.01M12 15.5v-3.2a1.6 1.6 0 0 1 3.2 0v3.2" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common} stroke="#111827">
          <path d="M14 7v6.5a2.5 2.5 0 1 1-2.5-2.5" />
          <path d="M14 7c1 1.2 2.2 1.8 3.6 1.9" />
        </svg>
      );
    case "x":
      return (
        <svg {...common} stroke="#111827">
          <path d="M5 5l14 14M19 5L5 19" />
        </svg>
      );
    case "youtube":
      return (
        <svg {...common} stroke="#DC2626">
          <rect x="3.5" y="6.5" width="17" height="11" rx="3" />
          <path d="M11 10l4 2-4 2z" />
        </svg>
      );
    default:
      return null;
  }
}
