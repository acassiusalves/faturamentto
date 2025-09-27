
import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";


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

export function MercadoLivreLogo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-auto", className)}
      {...props}
    >
        <path d="M410.29 328.62c-23.45-3.09-47.53-11.43-69.13-24.06 4.8-12.3 8.94-25.22 12.63-38.41 12.64-4.54 25.4-8.15 38.41-10.92a197.5 197.5 0 0148.81 0c13,2.77 25.77,6.38 38.41,10.92 3.69,13.19 7.83,26.11 12.63,38.41-21.6,12.63-45.68,20.97-69.13,24.06a197.5,197.5,0,0,1-12.63,0z" fill="#fff"/>
        <path d="M495 256a199.37 199.37 0 00-111.45-176.4A201.23 201.23 0 00256 61C159.24 61 74.45 130.68 35.4 224h439.18A198.83 198.83 0 00495 256z" fill="#ffe600"/>
        <path d="M35.4 224a199.08 199.08 0 00-17.8 88.38c11.83 83.17 81.1 146.43 167.89 146.43 84.73 0 156.34-60.62 168.32-142.36l-89.76-22.44-89.76-22.44-89.77-22.44-79.31-19.83z" fill="#3483fa"/>
        <path d="M370.52 289.47l-112.44-28.11-112.44-28.11a201.22 201.22 0 00-110.24 35.41l79.31 19.83 89.77 22.44 89.76 22.44 89.76 22.44a200.21 200.21 0 00-24.48-66.3z" fill="#2968c8"/>
        <path d="M403.58,299.13l-105.77-26.44c-14.52-3.63-29.43-5.41-44.47-5.41-15.34,0-30.54,1.84-45.31,5.55l-106.86,26.71c.17.58.34,1.16.51,1.74l106.35-26.59c14.77-3.71,29.97-5.55,45.31-5.55s30.54,1.84,45.31,5.55l105.77,26.44c.17-.58.34-1.16.51-1.74Z" fill="#fff"/>
        <path d="M297.81 267.28l-.33.13-41.48-10.37-41.48-10.37.33-.13c-28.61-11.45-53.73-11.45-82.34,0l-.33.13L173.66,236c28.61-11.45,53.73-11.45,82.34,0Z" fill="#fff"/>
        <path d="M192.51 292.1l23.16 5.79c13.7,3.43,27.67,5.1,41.79,5.1s28.09-1.67,41.79-5.1l23.16-5.79-23.16,5.79c-13.7,3.43-27.67,5.1-41.79,5.1s-28.09-1.67-41.79-5.1Z" fill="#fff"/>
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

export function FullIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/ml-full-green.svg"
      alt="Mercado Livre Full"
      width={88}
      height={26}
      className={cn("h-5 w-auto", className)}
      data-ai-hint="logo"
    />
  );
}

export function FreteGratisIcon({ className }: { className?: string }) {
    return (
        <Image
            src="/icons/frete-gratis.svg"
            alt="Frete Grátis"
            width={150}
            height={30}
            className={cn("h-4 w-auto", className)}
            data-ai-hint="shipping icon"
        />
    )
}

export function CorreiosLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/correios-logo.svg"
      alt="Correios"
      width={254}
      height={69}
      className={cn("h-4 w-auto", className)}
      data-ai-hint="company logo"
    />
  );
}

export function MercadoEnviosIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/mercado-envios.svg"
      alt="Mercado Envios"
      width={720}
      height={130}
      className={cn("h-5 w-auto", className)}
      data-ai-hint="company logo"
    />
  );
}
