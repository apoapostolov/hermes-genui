// Modules the bundler provides: the Hermes plugin SDK (supplied by the app at runtime) and CSS imported as text.
declare module "@hermes/plugin-sdk" {
  export const TRANSCRIPT_DIRECTIVE_AREA: string;
  /** The app's curated verbs; only the composer draft API is used here (see the SDK's "Composer draft API"). */
  export const host: {
    composer?: {
      submit(sessionId: string | null, text: string): boolean;
      insertText(sessionId: string | null, text: string, opts?: { mode?: "block" | "inline" | "prefix" }): Promise<boolean>;
      focus(sessionId: string | null): void;
    };
    navigate?: (path: string) => void;
  };
}

declare module "*.css" {
  const text: string;
  export default text;
}
