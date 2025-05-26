import type { SVGProps } from 'react';

export function MilkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 2h8" />
      <path d="M9 2v1.5A2.5 2.5 0 0 1 6.5 6V14a6 6 0 0 0 6 6h0a6 6 0 0 0 6-6V6A2.5 2.5 0 0 1 15 3.5V2" />
      <path d="M6.5 10h0" />
      <path d="M17.5 10h0" />
      <path d="M7 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1" />
    </svg>
  );
}
