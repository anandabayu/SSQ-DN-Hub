import { Button, Card, Input } from "@/components/ui";

import { addActivity, addCharacter } from "./actions";

/** Only rendered when you are looking at your own tracker. */
export function AddForms() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card title="Add Character">
        <form action={addCharacter} className="flex flex-wrap gap-2">
          <Input
            name="name"
            placeholder="Character name"
            maxLength={40}
            required
            className="min-w-0 flex-1"
          />
          <Input
            name="job"
            placeholder="Class"
            maxLength={40}
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="primary">
            Add
          </Button>
        </form>
      </Card>

      <Card title="Add Activity">
        <form action={addActivity} className="flex flex-wrap gap-2">
          <Input
            name="name"
            placeholder="e.g. SDN Core"
            maxLength={40}
            required
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="primary">
            Add
          </Button>
        </form>
      </Card>
    </div>
  );
}
