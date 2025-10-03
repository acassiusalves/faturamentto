

import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import React from 'react';


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

export function MercadoLivreLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", className)}
      {...props}
    >
      <path d="M18.5 12.015c-1.373-.83-2.85-1.424-4.52-1.728.32-1.168.61-2.378.88-3.606.84-.424 1.68-.78 2.52-1.03a12.87 12.87 0 013.25-.015c.85.25 1.7.605 2.53 1.03.27 1.228.56 2.438.88 3.605-1.432.88-2.992 1.543-4.512 1.728a13.3 13.3 0 01-1.028 0z" fill="#fff"/>
      <path d="M21.5 5.5A12.5 12.5 0 0012 2.5 12.5 12.5 0 00.5 13h21a12.5 12.5 0 000-7.5z" fill="#FFE600"/>
      <path d="M.5 13A12.5 12.5 0 000 18.5c.78 5.545 5.4 9.89 10.93 9.89a12.5 12.5 0 0011.22-8.156l-5.98-1.494-5.98-1.495-5.98-1.494-5.28-1.32z" fill="#3483FA"/>
      <path d="M14.5 15.5l-7.49-1.873-7.49-1.874a12.5 12.5 0 00-7.35 2.36l5.28 1.321 5.98 1.495 5.98 1.494 5.98 1.495a12.5 12.5 0 00-1.63-4.42z" fill="#2968C8"/>
      <path d="M17.56 16.59l-7.05-1.762c-.967-.242-1.96-.36-2.96-.36-1.021 0-2.034.123-3.018.37L.5 15.903c.01.039.02.077.03.116l7.09-1.772c.983-.247 2-.37 3.02-.37s2.03.123 3.01.37l7.05 1.762c.01-.038.02-.077.03-.116z" fill="#fff"/>
      <path d="M12.89 14.12l-.02.01-2.76-0.69-2.76-0.69.02-.01c-1.9-0.76-3.58-0.76-5.48 0l-0.02.01L1.87 12.06c1.9-0.76 3.58-0.76 5.48 0z" fill="#fff"/>
      <path d="M8.05 16.14l1.54.386c.91.229 1.84.34 2.78.34s1.87-.111 2.78-.34l1.54-.386-1.54.386c-.91.229-1.84.34-2.78.34s-1.87-.111-2.78-.34z" fill="#fff"/>
    </svg>
  );
}

export function MercadoLivreIcon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path d="M18.5 12.015c-1.373-.83-2.85-1.424-4.52-1.728.32-1.168.61-2.378.88-3.606.84-.424 1.68-.78 2.52-1.03a12.87 12.87 0 013.25-.015c.85.25 1.7.605 2.53 1.03.27 1.228.56 2.438.88 3.605-1.432.88-2.992 1.543-4.512 1.728a13.3 13.3 0 01-1.028 0z" fill="#fff"/>
        <path d="M21.5 5.5A12.5 12.5 0 0012 2.5 12.5 12.5 0 00.5 13h21a12.5 12.5 0 000-7.5z" fill="#FFE600"/>
        <path d="M.5 13A12.5 12.5 0 000 18.5c.78 5.545 5.4 9.89 10.93 9.89a12.5 12.5 0 0011.22-8.156l-5.98-1.494-5.98-1.495-5.98-1.494-5.28-1.32z" fill="#3483FA"/>
        <path d="M14.5 15.5l-7.49-1.873-7.49-1.874a12.5 12.5 0 00-7.35 2.36l5.28 1.321 5.98 1.495 5.98 1.494 5.98 1.495a12.5 12.5 0 00-1.63-4.42z" fill="#2968C8"/>
        <path d="M17.56 16.59l-7.05-1.762c-.967-.242-1.96-.36-2.96-.36-1.021 0-2.034.123-3.018.37L.5 15.903c.01.039.02.077.03.116l7.09-1.772c.983-.247 2-.37 3.02-.37s2.03.123 3.01.37l7.05 1.762c.01-.038.02-.077.03-.116z" fill="#fff"/>
        <path d="M12.89 14.12l-.02.01-2.76-0.69-2.76-0.69.02-.01c-1.9-0.76-3.58-0.76-5.48 0l-0.02.01L1.87 12.06c1.9-0.76 3.58-0.76 5.48 0z" fill="#fff"/>
        <path d="M8.05 16.14l1.54.386c.91.229 1.84.34 2.78.34s1.87-.111 2.78-.34l1.54-.386-1.54.386c-.91.229-1.84.34-2.78.34s-1.87-.111-2.78-.34z" fill="#fff"/>
      </svg>
    )
}

export function MagaluLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 256 256"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-6 w-6", className)}
        {...props}
      >
        <path
          fill="#0086FE"
          d="M192.341 0H63.659L0 109.11h256L192.341 0z"
        ></path>
        <path
          fill="#00529A"
          d="M128 206.89L0 109.11h63.659L128 0l64.341 109.11H256L128 206.89z"
        ></path>
        <path
          fill="#0086FE"
          d="M128 206.89l-31.829-54.272h63.658L128 206.89z"
        ></path>
        <path
          fill="#00529A"
          d="M128 206.89L96.171 152.618h31.829L128 206.89z"
        ></path>
        <path
          fill="#0086FE"
          d="M128 256l-31.829-54.272H31.83L128 256zM128 256l31.829-54.272h64.341L128 256z"
        ></path>
        <path
          fill="#00529A"
          d="M128 256l-31.829-54.272h31.829L128 256z"
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

export function FlexIcon({ className }: { className?: string }) {
  return (
    <Image
      src="/icons/mercado-livre-flex.svg"
      alt="Mercado Livre Flex"
      width={88}
      height={26}
      className={cn("h-5 w-auto", className)}
      data-ai-hint="logo"
    />
  );
}

