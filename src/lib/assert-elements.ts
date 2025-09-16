
// src/lib/assert-elements.ts
export function assertElements(objs: Record<string, unknown>) {
  const bad: string[] = [];
  for (const [name, val] of Object.entries(objs)) {
    // válido: function component, string tag, React.forwardRef (function), ou objeto com $$typeof (mas vamos focar em function)
    const ok =
      typeof val === "function" ||
      typeof val === "string" ||
      (val && typeof val === "object" && "$$typeof" in (val as any));

    if (!ok) bad.push(name);
  }
  if (bad.length) {
    const details = Object.fromEntries(
      Object.entries(objs).map(([k, v]) => [k, typeof v])
    );
    // explode com mensagem clara no console e na tela
    const msg = `[ETIQUETAS] Imports inválidos: ${bad.join(", ")}. Tipos: ${JSON.stringify(details)}`;
    // eslint-disable-next-line no-console
    console.error(msg, objs);
    throw new Error(msg);
  }
}
