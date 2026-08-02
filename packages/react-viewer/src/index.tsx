import * as React from "react";

export type SpreadsheetViewerProps = Omit<
  React.IframeHTMLAttributes<HTMLIFrameElement>,
  "src"
> & {
  /** Absolute URL of a `/view/:id` route on the typework viewer service. */
  src: string;
};

/**
 * Thin iframe shim for the static-HTML typework spreadsheet viewer.
 * Frame content is rendered server-side (excelrs -> HTML); this component owns
 * no editor, no JS bundle, no DocsAPI/JWT/co-editing handshake.
 */
export const SpreadsheetViewer = ({
  src,
  title = "Spreadsheet",
  ...rest
}: SpreadsheetViewerProps) =>
  React.createElement("iframe", {
    src,
    title,
    frameBorder: 0,
    allow: "fullscreen",
    ...rest,
  });

SpreadsheetViewer.displayName = "SpreadsheetViewer";