
"use client";

import type { Notice } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Megaphone, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface NoticesDisplayProps {
  notices: Notice[];
}

const noticeConfig = {
  info: { icon: Info, variant: "default", className: "bg-blue-50 border-blue-200 text-blue-800 [&>svg]:text-blue-600" },
  warning: { icon: AlertTriangle, variant: "default", className: "bg-yellow-50 border-yellow-200 text-yellow-800 [&>svg]:text-yellow-600" },
  success: { icon: CheckCircle, variant: "default", className: "bg-green-50 border-green-200 text-green-800 [&>svg]:text-green-600" },
  destructive: { icon: Megaphone, variant: "destructive" },
};

export function NoticesDisplay({ notices }: NoticesDisplayProps) {
  if (!notices || notices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 mb-8">
      {notices.map((notice) => {
        const config = noticeConfig[notice.type] || noticeConfig.info;
        const Icon = config.icon;

        return (
          <Alert key={notice.id} variant={config.variant as any} className={config.className}>
            <Icon className="h-4 w-4" />
            <AlertTitle className="font-bold">{notice.title}</AlertTitle>
            <AlertDescription>{notice.message}</AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}
