import type { Speaker } from "@/lib/types";

/**
 * Colour is doing real work here, not decoration: on a nine-person call the avatar colour is how
 * you track who is talking while scanning, before you read the name.
 */
export function SpeakerChip({ speaker, size = 36 }: { speaker?: Speaker | null; size?: number }) {
  const color = speaker ? `var(--sp-${(speaker.colorIndex % 8) + 1})` : "var(--text-faint)";
  return (
    <span
      className="flex items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
      }}
      title={speaker?.name ?? "Unattributed"}
    >
      {speaker?.initials ?? "?"}
    </span>
  );
}
