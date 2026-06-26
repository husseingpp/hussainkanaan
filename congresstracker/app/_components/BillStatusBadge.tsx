/** Badge indicating whether a bill became law. */
export function BillStatusBadge({ becameLaw }: { becameLaw: boolean }) {
  if (becameLaw) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        Became law
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
      In progress
    </span>
  );
}
