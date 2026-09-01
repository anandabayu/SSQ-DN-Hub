import Image from "next/image";

import logo from "../../public/logo.png";

/**
 * Stream Squad shield.
 *
 * Imported statically rather than referenced as "/logo.png" so Next
 * fingerprints the file: the URL changes whenever the artwork does, which
 * busts the browser cache automatically. A bare string URL stays identical
 * across logo changes and browsers keep serving the stale one.
 *
 * The static import also supplies the intrinsic dimensions, so callers only
 * need to constrain the height — the PNG is trimmed to the shield and is
 * wider than it is tall.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt="Stream Squad"
      className={`object-contain ${className ?? ""}`}
      priority
    />
  );
}

export const DISCORD_INVITE_URL = "https://discord.com/invite/pWarPfV3TA";

/** Official Discord mark. */
export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 127.14 96.36"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21H.55A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
  );
}

/** Invite button. Opens in a new tab — it leaves the app. */
export function DiscordLink({ className }: { className?: string }) {
  return (
    <a
      href={DISCORD_INVITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={
        "inline-flex items-center justify-center gap-2 rounded-lg border " +
        "border-[#5865F2]/40 bg-[#5865F2]/10 px-3.5 py-2 text-sm font-medium " +
        "text-fg transition-colors hover:border-[#5865F2] hover:bg-[#5865F2]/20 " +
        `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5865F2] ${className ?? ""}`
      }
    >
      <DiscordIcon className="h-4 w-4 text-[#5865F2]" />
      Join our Discord
    </a>
  );
}
