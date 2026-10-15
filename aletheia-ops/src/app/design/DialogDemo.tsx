"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";

// Opens each dialog variant on the design page.
export function DialogDemo() {
  const [which, setWhich] = useState<null | "confirm" | "typed" | "panel">(null);
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => setWhich("confirm")}>Request revision (reason)</Button>
      <Button variant="danger" onClick={() => setWhich("typed")}>
        Withdraw publication (typed)
      </Button>
      <Button variant="quiet" onClick={() => setWhich("panel")}>
        Open side panel
      </Button>
      <ConfirmDialog
        open={which === "confirm"}
        onClose={() => setWhich(null)}
        onConfirm={() => setWhich(null)}
        title="Request revision"
        consequence="The decision returns to its author, Tobias Aldridge, with your reasons. A revised version will need adoption and approval again."
        confirmLabel="Request revision"
        reasonLabel="Reason, shown to the author"
        reasonHint="Say what must change. The author sees this exactly as written."
      />
      <ConfirmDialog
        open={which === "typed"}
        onClose={() => setWhich(null)}
        onConfirm={() => setWhich(null)}
        title="Withdraw from the public record"
        consequence={
          <p>
            AGV-DOC-2026-0003 will be marked withdrawn on aletheiagov.org. The page stays, with a withdrawal notice and your reason; the record cannot be published again under this reference.
          </p>
        }
        confirmLabel="Withdraw from the public record"
        variant="danger"
        reasonLabel="Reason, published with the notice"
        typeToConfirm="AGV-DOC-2026-0003"
      />
      <Dialog open={which === "panel"} onClose={() => setWhich(null)} title="Version 2" description="Submitted 14 Oct 2026, 08:02 WAT by Tobias Aldridge" variant="panel">
        <p className="text-body font-normal text-ink">A side panel slides in from the edge of the record it belongs to, and closes with Escape.</p>
      </Dialog>
    </div>
  );
}
