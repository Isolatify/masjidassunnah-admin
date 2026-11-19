import { useId } from "react";

/**
 * Girih lattice (120px tile, 0.5px #2C8A66 stroke) used as a background
 * texture on dark bands. Drop it in as the FIRST child of a
 * `relative overflow-hidden` parent:
 *   <GirihPattern className="pointer-events-none absolute inset-0" />
 */
export default function GirihPattern({ className = "" }: { className?: string }) {
  const raw = useId();
  const id = `girih${raw.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <svg
      width="100%"
      height="100%"
      aria-hidden="true"
      className={className}
      style={{ opacity: 0.15 }}
    >
      <defs>
        <pattern
          id={id}
          x="0"
          y="0"
          width="120"
          height="120"
          patternUnits="userSpaceOnUse"
        >
          <g
            stroke="#2C8A66"
            strokeWidth="0.5"
            fill="none"
            strokeLinejoin="round"
          >
            <polygon points="60.00,21.60 67.35,42.26 87.15,32.85 77.74,52.65 98.40,60.00 77.74,67.35 87.15,87.15 67.35,77.74 60.00,98.40 52.65,77.74 32.85,87.15 42.26,67.35 21.60,60.00 42.26,52.65 32.85,32.85 52.65,42.26" />
            <line x1="60" y1="21.6" x2="60" y2="0" />
            <line x1="60" y1="98.4" x2="60" y2="120" />
            <line x1="21.6" y1="60" x2="0" y2="60" />
            <line x1="98.4" y1="60" x2="120" y2="60" />
            <line
              x1="32.84709960243657"
              y1="32.84709960243657"
              x2="0"
              y2="0"
            />
            <line
              x1="87.15290039756343"
              y1="32.84709960243657"
              x2="120"
              y2="0"
            />
            <line
              x1="32.84709960243657"
              y1="87.15290039756343"
              x2="0"
              y2="120"
            />
            <line
              x1="87.15290039756343"
              y1="87.15290039756343"
              x2="120"
              y2="120"
            />
            <polygon
              points="60,0 77.28,17.28 60,34.56 42.72,17.28"
              opacity="0.7"
            />
            <polygon
              points="60,120 77.28,102.72 60,85.44 42.72,102.72"
              opacity="0.7"
            />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
