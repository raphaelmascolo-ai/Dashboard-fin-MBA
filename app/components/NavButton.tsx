import Link from "next/link";

// Bouton de navigation iOS-style — adapté à la palette MBA Groupe SA
// (jaune + noir charbon). Zone de tap >= 44px, feedback visuel au tap.
export default function NavButton({
  href,
  label,
  direction = "back",
  variant = "primary",
}: {
  href: string;
  label: string;
  direction?: "back" | "forward" | "none";
  variant?: "primary" | "neutral";
}) {
  const color = variant === "primary" ? "text-[#1a1a1a]" : "text-[#6b7280]";
  const negMargin = direction === "back" ? "-ml-2" : direction === "forward" ? "-mr-2" : "";

  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 px-2 sm:px-3 py-2.5 rounded-xl ${color} hover:bg-[#fef3c7] active:bg-[#facc15] active:scale-95 transition-all min-h-[44px] -my-1 ${negMargin}`}
    >
      {direction === "back" && (
        <svg className="w-6 h-6 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span className="text-base font-semibold">{label}</span>
      {direction === "forward" && (
        <svg className="w-6 h-6 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </Link>
  );
}
