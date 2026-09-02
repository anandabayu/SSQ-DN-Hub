/**
 * Shown while a page's data loads.
 *
 * The nav lives in the layout above this boundary, so it stays put and only
 * the content area swaps — navigation feels immediate even though the queries
 * underneath still take as long as they take.
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-6 w-48 rounded bg-panel-2" />
      <div className="h-4 w-72 rounded bg-panel-2/60" />

      <div className="rounded-xl border border-line bg-panel/60 p-5">
        <div className="space-y-3">
          <div className="h-4 w-full rounded bg-panel-2/70" />
          <div className="h-4 w-11/12 rounded bg-panel-2/60" />
          <div className="h-4 w-4/5 rounded bg-panel-2/50" />
          <div className="h-4 w-2/3 rounded bg-panel-2/40" />
        </div>
      </div>
    </div>
  );
}
