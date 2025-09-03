import type { SVGProps } from "react";

export function MarketFlowLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      <path d="M17.5 14.5l-3.5 2-3.5-2" />
      <path d="M12 22V17" />
    </svg>
  );
}

export function MercadoLivreLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 44 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M3.73 28.526V11.579h6.815l.135 14.158h7.02v-19.84L10.675 3.526H.21v25h17.48v-2.789H3.73zM25.79 28.526V3.526h10.435l4.05 13.053 3.645-13.053H44v25h-3.445V7.421l-3.645 13.263h-3.24l-3.712-13.263v21.105H25.79z"
        fill="currentColor"
      ></path>
    </svg>
  );
}

export function AmazonLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fill="#FF9900"
        d="M500 1000C223.9 1000 0 776.1 0 500S223.9 0 500 0s500 223.9 500 500-223.9 500-500 500zm218.9-432.3c-24.1-15.3-51.4-23.6-88.7-23.6-59.5 0-101.4 30-118.9 69.4-2.8 6.4-5.2 13.1-7.1 20-22-39.4-33.8-85.3-33.8-132.8C270.4 340.8 381.1 250 503.7 250c90.2 0 162.2 46.2 189.9 116.8l-42.5 25.5c-16.7-47.3-60.1-80-147.4-80-99.7 0-179.9 76.8-179.9 181.9 0 35.1 8.9 69.9 26.6 99.4 1.1 1.9 2.2 3.8 3.5 5.6 1.3 1.8 2.6 3.5 3.9 5.3 2.1 2.8 4.2 5.5 6.3 8.2 18.2-34.6 52.8-56.7 94.8-56.7 30.6 0 52.2 6.9 67.8 19.3 17.3 13.8 26.3 35.1 26.3 60.1 0 32.2-13.1 57.3-40.4 75.5-26.6 17.9-63.1 26.6-111.4 26.6-14.9 0-29.8-1.1-44.1-3.3l-5.6 33.8c16.2 2.5 32.5 3.8 49.1 3.8 99.7 0 179.9-46.7 179.9-130.6 0-41.9-15.6-78.4-44.1-105.7z"
      ></path>
    </svg>
  );
}
