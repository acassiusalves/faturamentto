import { Button } from "@/components/ui/button";
import { MarketFlowLogo } from "@/components/icons";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex items-center">
          <MarketFlowLogo className="h-6 w-6 mr-2 text-primary" />
          <h1 className="text-xl font-bold text-foreground">MarketFlow</h1>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button>
            <svg
              className="mr-2 h-4 w-4"
              aria-hidden="true"
              focusable="false"
              data-prefix="fab"
              data-icon="google"
              role="img"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 488 512"
              fill="currentColor"
            >
              <path d="M488 261.8C488 403.3 381.5 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 21.2 173.3 57.2l-65.4 64.2c-20.2-16.1-49-26.6-80.6-26.6-62.3 0-113.4 51.6-113.4 114.9s51.1 114.9 113.4 114.9c73.3 0 99.1-44.9 102.7-67.9H248v-83.3h235.2c4.7 25.4 7.1 52.1 7.1 81.2z"></path>
            </svg>
            Conectar com Google Planilhas
          </Button>
        </div>
      </div>
    </header>
  );
}
