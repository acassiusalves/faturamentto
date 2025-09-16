
"use client";

import { useFormState } from "react-dom";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2 } from "lucide-react";
import { debugMappingAction } from "@/app/actions";
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
      Debug Mapeamento
    </Button>
  );
}

export function MappingDebugger({ zpl }: { zpl: string }) {
  const [state, formAction] = useFormState(debugMappingAction, { result: null as any, error: null as any });

  return (
    <div className="mt-2">
      <form action={formAction}>
        <input type="hidden" name="zplContent" value={zpl} />
        <SubmitButton />
      </form>

      {state?.result && (
        <pre className="mt-2 p-2 text-xs bg-muted rounded overflow-auto max-h-64">
          {JSON.stringify(state.result, null, 2)}
        </pre>
      )}
      {state?.error && <p className="text-sm text-destructive">{String(state.error)}</p>}
    </div>
  );
}
