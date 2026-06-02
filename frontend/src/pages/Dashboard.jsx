import { useEffect, useState } from "react";
import { getDashboard } from "../api/client";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getDashboard()
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load dashboard data"));
  }, []);

  if (error) return <p className="text-red-500 p-6">{error}</p>;
  if (!data) return <p className="p-6 text-gray-500">Loading...</p>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Products" value={data.total_products} color="blue" />
        <StatCard label="Total Customers" value={data.total_customers} color="green" />
        <StatCard label="Total Orders" value={data.total_orders} color="purple" />
      </div>

      <h2 className="text-lg font-semibold mb-3 text-gray-700">Low Stock Products (≤{data.low_stock_threshold})</h2>
      {data.low_stock_products.length === 0 ? (
        <p className="text-gray-500">All products are sufficiently stocked.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white shadow rounded-lg overflow-hidden">
            <thead className="bg-yellow-100 text-yellow-800 text-sm">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">SKU</th>
                <th className="text-left px-4 py-2">Stock</th>
              </tr>
            </thead>
            <tbody>
              {data.low_stock_products.map((p) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-gray-500">{p.sku}</td>
                  <td className="px-4 py-2 font-semibold text-red-600">{p.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
  };
  return (
    <div className={`border rounded-lg p-5 ${colors[color]}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-4xl font-bold mt-1">{value}</p>
    </div>
  );
}
