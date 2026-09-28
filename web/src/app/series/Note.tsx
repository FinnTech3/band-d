import type { ReactNode } from "react";
import { Monogram } from "./Monogram";

/** A few words from me at the top of the page, there from the first paint. */
export function Note({ children }: { children: ReactNode }) {
  return (
    <aside className="note-from" aria-label="A note from Finn">
      <div className="who">
        <Monogram size={18} label={null} />A note from Finn
      </div>
      <p>{children}</p>
    </aside>
  );
}
