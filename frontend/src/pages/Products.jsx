import { useEffect, useState, useCallback } from "react";
import { getProducts, createProduct, updateProduct, deleteProduct, getDashboard } from "../api/client";
import Toast from "../components/Toast";
import Pagination from "../components/Pagination";

const emptyForm = { name: "", sku: "", price: "", quantity: "" };

export default function Products() {
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1, size: 10 });
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  useEffect(() => {
    getDashboard().then((res) => setLowStockThreshold(res.data.low_stock_threshold)).catch(() => {});
  }, []);

  const load = useCallback((p = page) => {
    getProducts(p, 10).then((res) => {
      setProducts(res.data.items);
      setPagination({ total: res.data.total, pages: res.data.pages, size: res.data.size });
    }).catch(() => setToast({ message: "Failed to load products", type: "error" }));
  }, [page]);

  useEffect(() => { load(page); }, [page, load]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.sku.trim()) e.sku = "SKU is required";
    if (!form.price || isNaN(form.price) || Number(form.price) < 0) e.price = "Valid price required";
    if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) < 0) e.quantity = "Valid quantity required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => { setForm(emptyForm); setEditId(null); setErrors({}); setShowModal(true); };
  const openEdit = (p) => { setForm({ name: p.name, sku: p.sku, price: p.price, quantity: p.quantity }); setEditId(p.id); setErrors({}); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = { ...form, price: Number(form.price), quantity: Number(form.quantity) };
    try {
      if (editId) {
        await updateProduct(editId, payload);
        setToast({ message: "Product updated", type: "success" });
      } else {
        await createProduct(payload);
        setToast({ message: "Product created", type: "success" });
      }
      setShowModal(false);
      load(page);
    } catch (err) {
      setToast({ message: err.response?.data?.detail || "Error saving product", type: "error" });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;
    try {
      await deleteProduct(id);
      setToast({ message: "Product deleted", type: "success" });
      load(page);
    } catch {
      setToast({ message: "Failed to delete product", type: "error" });
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Products</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + Add Product
        </button>
      </div>

      <div className="overflow-x-auto bg-white shadow rounded-lg">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 text-gray-600 text-sm">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">SKU</th>
              <th className="text-left px-4 py-3">Price</th>
              <th className="text-left px-4 py-3">Stock</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-gray-400">No products yet</td></tr>
            )}
            {products.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3 text-gray-500">{p.sku}</td>
                <td className="px-4 py-3">${Number(p.price).toFixed(2)}</td>
                <td className={`px-4 py-3 font-semibold ${p.quantity <= lowStockThreshold ? "text-red-600" : "text-green-600"}`}>{p.quantity}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEdit(p)} className="text-blue-600 hover:underline text-sm">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline text-sm">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pages={pagination.pages} total={pagination.total} size={pagination.size} onPage={setPage} />

      {showModal && (
        <Modal title={editId ? "Edit Product" : "Add Product"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Name" error={errors.name}>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="SKU" error={errors.sku}>
              <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <Field label="Price" error={errors.price}>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="Quantity" error={errors.quantity}>
              <input className="input" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
