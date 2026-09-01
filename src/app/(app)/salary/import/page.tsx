import Link from "next/link";

import { Button } from "@/components/ui";

import { ImportForm } from "./import-form";

export const metadata = { title: "Import — SSQ DN Hub" };

export default function ImportPage() {
  return (
    <div className="space-y-4">
      <Link href="/salary" className="inline-block">
        <Button>&larr; All parties</Button>
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Import from DN Salary</h1>
        <p className="mt-1 text-sm text-fg-dim">
          Open the old app, click <strong>Export Data (JSON)</strong>, and drop
          the file here. Parties, players and loot come across; webhook URLs are
          skipped and should be re-entered by an admin.
        </p>
      </div>

      <ImportForm />
    </div>
  );
}
