function ShimmerBlock({ className }) {
  return <div className={`shimmer rounded ${className}`} />;
}

function ShimmerRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <ShimmerBlock className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function ShimmerTableRows({ cols, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <ShimmerRow key={i} cols={cols} />
  ));
}

export function ShimmerDashboard() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <ShimmerBlock className="h-8 w-40 mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border rounded-lg p-5">
            <ShimmerBlock className="h-4 w-28 mb-3" />
            <ShimmerBlock className="h-10 w-16" />
          </div>
        ))}
      </div>
      <ShimmerBlock className="h-5 w-56 mb-3" />
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b">
            <ShimmerBlock className="h-4 flex-1" />
            <ShimmerBlock className="h-4 w-20" />
            <ShimmerBlock className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
