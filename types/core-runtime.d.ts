// Laufzeit-APIs, die in allen JS-Umgebungen (Browser, Node, Deno) vorhanden sind,
// deren Typen aber in lib.dom stehen. Der Core bleibt damit DOM-frei (ADR 0007).
declare class TextEncoder {
  encode(input?: string): Uint8Array;
}
declare class TextDecoder {
  constructor(label?: string);
  decode(input?: Uint8Array): string;
}
