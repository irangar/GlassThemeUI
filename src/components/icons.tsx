import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M39.7 8.9c3.4-1.4 6.4 1.6 5.1 5-2.6 6.6-3.8 13.6-2.9 20.5 2 19.8 19.7 34.2 39.5 32.2 3.3-.3 6.6-1.1 9.7-2.3 3.4-1.3 6.5 1.8 5 5.2A45.2 45.2 0 1 1 39.7 8.9Z" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 100 90" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M14 17h13l6-6c2-2 4-3 7-3h20c3 0 5 1 7 3l6 6h13c8 0 12 5 12 13v42c0 8-5 13-13 13H15C7 85 2 80 2 72V30c0-8 4-13 12-13Zm36 13a21 21 0 1 0 0 42 21 21 0 0 0 0-42Zm0 8a13 13 0 1 1 0 26 13 13 0 0 1 0-26Zm32-10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"
      />
    </svg>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" {...props}>
      <path
        d="M28 70H17a9 9 0 0 1-9-9V24a9 9 0 0 1 9-9h45a9 9 0 0 1 9 9v8"
        stroke="currentColor"
        strokeOpacity=".47"
        strokeWidth="8"
        strokeLinejoin="round"
      />
      <rect x="28" y="32" width="64" height="52" rx="10" stroke="currentColor" strokeWidth="8" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m3 17 5-5 4 4 3-3 6 6" strokeLinejoin="round" />
    </svg>
  );
}

export function GradientIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M7 7v10M10.5 7v10M14 7v10M17.5 7v10" strokeDasharray="1 2" strokeLinecap="round" />
      <path d="M7 7v10M10.5 7v10" opacity=".55" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" {...props}>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}
