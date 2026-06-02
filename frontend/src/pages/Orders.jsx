import { useEffect, useState, useCallback } from "react";
import { getOrders, getOrder, createOrder, deleteOrder, getCustomers, getProducts } from "../api/client";
import Toast from "../components/Toast";
import Pagination from "../components/Pagination";
import { ShimmerTableRows } from "../components/ShimmerLoading";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, size: 10 });
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    document.title = "Orders";
  }, []);

  const load = useCallback((p = page) => {
    setLoading(true);
    getOrders(p, 10).then((res) => {
      setOrders(res.data.items);
      setPagination({ total: res.data.total, pages: res.data.pages, size: res.data.size });
      setLoading(false);
    }).catch(() => { setToast({ message: "Failed to load orders", type: "error" }); setLoading(false); });
  }, [page]);

  async function fetchAll(fetchFn, setter) {
    try {
      const first = await fetchFn(1, 100);
      const { items, pages } = first.data;
      if (pages <= 1) { setter(items); return; }
      const rest = await Promise.all(
        Array.from({ length: pages - 1 }, (_, i) => fetchFn(i + 2, 100).then((r) => r.data.items))
      );
      setter(items.concat(...rest));
    } catch {}
  }

  useEffect(() => {
    fetchAll(getCustomers, setCustomers);
    fetchAll(getProducts, setProducts);
  }, []);

  useEffect(() => {
    if (showCreate) fetchAll(getProducts, setProducts);
  }, [showCreate]);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const openDetail = async (id) => {
    try {
      const res = await getOrder(id);
      setDetailOrder(res.data);
    } catch {
      setToast({ message: "Failed to load order details", type: "error" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Cancel this order? Stock will be restored.")) return;
    try {
      await deleteOrder(id);
      setToast({ message: "Order cancelled", type: "success" });
      load(page);
    } catch {
      setToast({ message: "Failed to cancel order", type: "error" });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
        <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + Create Order
        </button>
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 text-gray-600 text-sm">
            <tr>
              <th className="text-left px-4 py-3">Order ID</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Total</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <ShimmerTableRows cols={5} rows={6} />
            ) : (
            <>
            {orders.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-gray-400">No orders yet</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">#{o.id}</td>
                <td className="px-4 py-3">{o.customer.full_name}</td>
                <td className="px-4 py-3 font-semibold">${Number(o.total_amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-gray-500 text-sm">{new Date(o.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openDetail(o.id)} className="text-blue-600 hover:underline text-sm">Details</button>
                  <button onClick={() => handleDelete(o.id)} className="text-red-500 hover:underline text-sm">Cancel</button>
                </td>
              </tr>
            ))}
            </>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateOrderModal
          customers={customers}
          products={products}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(page); setToast({ message: "Order created", type: "success" }); }}
          onError={(msg) => setToast({ message: msg, type: "error" })}
        />
      )}

      <Pagination page={page} pages={pagination.pages} total={pagination.total} size={pagination.size} onPage={setPage} />

      {detailOrder && (
        <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function CreateOrderModal({ customers, products, onClose, onCreated, onError }) {
  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState([{ uid: crypto.randomUUID(), product_id: "", quantity: 1 }]);
  const [errors, setErrors] = useState({});

  const addItem = () => setItems([...items, { uid: crypto.randomUUID(), product_id: "", quantity: 1 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  };

  const validate = () => {
    const e = {};
    if (!customerId) e.customer = "Select a customer";
    items.forEach((item, i) => {
      if (!item.product_id) e[`product_${i}`] = "Select a product";
      if (!item.quantity || Number(item.quantity) <= 0) e[`qty_${i}`] = "Qty must be > 0";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createOrder({
        customer_id: Number(customerId),
        items: items.map((it) => ({ product_id: Number(it.product_id), quantity: Number(it.quantity) })),
      });
      onCreated();
    } catch (err) {
      onError(err.response?.data?.detail || "Failed to create order");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Create Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">-- Select customer --</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>)}
            </select>
            {errors.customer && <p className="text-red-500 text-xs mt-1">{errors.customer}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
            {items.map((item, i) => (
              <div key={item.uid} className="flex gap-2 mb-2 items-start">
                <div className="flex-1">
                  <select className="input" value={item.product_id} onChange={(e) => updateItem(i, "product_id", e.target.value)}>
                    <option value="">-- Product --</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name} (stock: {p.quantity})</option>)}
                  </select>
                  {errors[`product_${i}`] && <p className="text-red-500 text-xs mt-1">{errors[`product_${i}`]}</p>}
                </div>
                <div className="w-20">
                  <input className="input" type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="Qty" />
                  {errors[`qty_${i}`] && <p className="text-red-500 text-xs mt-1">{errors[`qty_${i}`]}</p>}
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 mt-2">✕</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addItem} className="text-blue-600 text-sm hover:underline mt-1">+ Add item</button>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Create</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Order #{order.id}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <p className="text-sm text-gray-500 mb-1">Customer: <span className="font-medium text-gray-800">{order.customer.full_name}</span></p>
        <p className="text-sm text-gray-500 mb-4">Date: {new Date(order.created_at).toLocaleString()}</p>
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-2">Product</th>
              <th className="text-left px-3 py-2">Qty</th>
              <th className="text-left px-3 py-2">Unit Price</th>
              <th className="text-left px-3 py-2">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">{item.product.name}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2">${Number(item.unit_price).toFixed(2)}</td>
                <td className="px-3 py-2">${(item.quantity * Number(item.unit_price)).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <p className="text-right font-bold mt-3 text-gray-800">Total: ${Number(order.total_amount).toFixed(2)}</p>
      </div>
    </div>
  );
}
