"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SimpleDataEditor({
  initial,
  onChange,
}: {
  initial: Record<string, any>;
  onChange?: (obj: Record<string, any>) => void;
}) {
  const [data, setData] = useState<Record<string, any>>(initial ?? {});
  const handleChange = (k: string, v: string) => {
    const next = { ...data, [k]: v };
    setData(next);
    onChange?.(next);
  };
  return (
    <div className="space-y-2">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-2 items-center">
          <Label className="truncate">{k}</Label>
          <Input value={String(v ?? "")} onChange={(e) => handleChange(k, e.target.value)} className="col-span-2" />
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => handleChange("novo_campo", "")}>
        + Campo
      </Button>
    </div>
  );
}
