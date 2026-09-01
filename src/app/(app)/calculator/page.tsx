import { Calculator } from "./calculator";

export const metadata = { title: "Calculator — SSQ DN Hub" };

export default function CalculatorPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Item Price Calculator</h1>
        <p className="mt-1 text-sm text-fg-dim">
          Scratchpad for pricing a stack of items. Nothing is saved — reload and
          it&apos;s empty.
        </p>
      </div>

      <Calculator />
    </div>
  );
}
