import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `px-4 py-2 rounded font-medium transition-colors ${
      isActive ? "bg-blue-700 text-white" : "text-blue-100 hover:bg-blue-600"
    }`;

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <nav className="bg-blue-800 text-white shadow-md">
      <div className="px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg">OrderMgmt</span>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <NavLink to="/" end className={linkClass}>Dashboard</NavLink>
          <NavLink to="/products" className={linkClass}>Products</NavLink>
          <NavLink to="/customers" className={linkClass}>Customers</NavLink>
          <NavLink to="/orders" className={linkClass}>Orders</NavLink>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <span className="text-blue-200 text-sm">{user?.username}</span>
          <button
            onClick={handleLogout}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-blue-100 hover:text-white text-2xl leading-none"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden px-4 pb-3 flex flex-col gap-1 border-t border-blue-700">
          <NavLink to="/" end className={linkClass} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
          <NavLink to="/products" className={linkClass} onClick={() => setMenuOpen(false)}>Products</NavLink>
          <NavLink to="/customers" className={linkClass} onClick={() => setMenuOpen(false)}>Customers</NavLink>
          <NavLink to="/orders" className={linkClass} onClick={() => setMenuOpen(false)}>Orders</NavLink>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-700">
            <span className="text-blue-200 text-sm">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
