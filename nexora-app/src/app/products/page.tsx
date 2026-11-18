"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Plus,
  Package,
  Pencil,
  Archive,
  X,
  Loader2,
  Boxes,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  status: "draft" | "active" | "archived";
  category_id: string | null;
  categories?: { name: string }[] | null;
  inventory?: { quantity: number; low_stock_threshold: number }[];
  variants?: { id: string; name: string; sku: string | null; price: number; inventory?: { quantity: number }[] }[];
};

type Category = {
  id: string;
  name: string;
};

export default function ProductsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [variantName, setVariantName] = useState("");
  const [variantSku, setVariantSku] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantQuantity, setVariantQuantity] = useState("0");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [stockHistory, setStockHistory] = useState<{ id: string; movement_type: string; quantity_change: number; reason: string | null; created_at: string }[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    sku: "",
    price: "",
    category_id: "",
    quantity: "0",
    status: "draft",
  });

  const loadProducts = useCallback(async () => {

    try {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: memberships, error: memberError } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1);

      if (memberError) throw memberError;

      if (!memberships?.length) {
        throw new Error("No active workspace found.");
      }

      const activeCompanyId = memberships[0].company_id;
      setCompanyId(activeCompanyId);

      const [productResult, categoryResult] = await Promise.all([
        supabase
          .from("products")
          .select("id,name,description,sku,price,status,category_id,categories!products_category_id_fkey(name),inventory!inventory_product_id_fkey(quantity,low_stock_threshold)")
          .eq("company_id", activeCompanyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id,name")
          .eq("company_id", activeCompanyId)
          .order("name"),
      ]);

      if (productResult.error) throw productResult.error;
      if (categoryResult.error) throw categoryResult.error;

      setProducts((productResult.data || []) as Product[]);
      setCategories(categoryResult.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load products.");
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  function openNewProduct() {
    setEditingId(null);
    setForm({
      name: "",
      description: "",
      sku: "",
      price: "",
      category_id: "",
      quantity: "0",
      status: "draft",
    });
    setShowForm(true);
  }

  function openEditProduct(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description || "",
      sku: product.sku || "",
      price: String(product.price),
      category_id: product.category_id || "",
      quantity: String(product.inventory?.[0]?.quantity ?? 0),
      status: product.status,
    });
    setShowForm(true);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      if (!companyId) throw new Error("Workspace not loaded.");

      const price = Number(form.price);
      const quantity = Number(form.quantity);

      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Enter a valid product price.");
      }

      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new Error("Stock must be a whole number greater than or equal to zero.");
      }

      const productData = {
        company_id: companyId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        sku: form.sku.trim() || null,
        price,
        category_id: form.category_id || null,
        status: form.status,
      };

      let productId = editingId;

      if (editingId) {
        const { error: updateError } = await supabase
          .from("products")
          .update(productData)
          .eq("id", editingId)
          .eq("company_id", companyId);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("products")
          .insert(productData)
          .select("id")
          .single();

        if (insertError) throw insertError;
        productId = data.id;
      }

      if (!productId) throw new Error("Product ID was not returned.");

      const { error: stockError } = await supabase.rpc(
        "set_product_stock",
        {
          p_company_id: companyId,
          p_product_id: productId,
          p_quantity: quantity,
          p_reason: editingId
            ? "Product form stock adjustment"
            : "Initial stock",
        }
      );

      if (stockError) throw stockError;

      const { error: thresholdError } = await supabase
        .from("inventory")
        .update({ low_stock_threshold: 5 })
        .eq("company_id", companyId)
        .eq("product_id", productId)
        .is("variant_id", null);

      if (thresholdError) throw thresholdError;

      setShowForm(false);
      setEditingId(null);
      await loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function restoreProduct(product: Product) {
    const { error: restoreError } = await supabase
      .from("products")
      .update({ status: "active" })
      .eq("id", product.id)
      .eq("company_id", companyId);

    if (restoreError) {
      setError(restoreError.message);
      return;
    }

    await loadProducts();
  }

  async function createCategory() {
    const name = categoryName.trim();
    if (!name || !companyId) return;

    const { error: categoryError } = await supabase
      .from("categories")
      .insert({ company_id: companyId, name });

    if (categoryError) {
      setError(categoryError.message);
      return;
    }

    setCategoryName("");
    await loadProducts();
  }

  async function createVariant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variantProduct || !companyId) return;

    const price = Number(variantPrice);
    const quantity = Number(variantQuantity);
    if (!variantName.trim() || !Number.isFinite(price) || price < 0 ||
        !Number.isInteger(quantity) || quantity < 0) {
      setError("Variant name, valid price and stock are required.");
      return;
    }

    let variantId = editingVariantId;

    if (editingVariantId) {
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          name: variantName.trim(),
          sku: variantSku.trim() || null,
          price,
        })
        .eq("id", editingVariantId)
        .eq("company_id", companyId)
        .eq("product_id", variantProduct.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("product_variants")
        .insert({
          company_id: companyId,
          product_id: variantProduct.id,
          name: variantName.trim(),
          sku: variantSku.trim() || null,
          price,
        })
        .select("id")
        .single();

      if (insertError) {
        setError(insertError.message);
        return;
      }
      variantId = data.id;
    }

    if (!variantId) return;

    const { error: stockError } = await supabase.rpc("set_variant_stock", {
      p_company_id: companyId,
      p_product_id: variantProduct.id,
      p_variant_id: variantId,
      p_quantity: quantity,
      p_reason: editingVariantId ? "Variant stock adjustment" : "Initial variant stock",
    });

    if (stockError) {
      setError(stockError.message);
      return;
    }

    setVariantProduct(null);
    setEditingVariantId(null);
    setVariantName("");
    setVariantSku("");
    setVariantPrice("");
    setVariantQuantity("0");
    await loadProducts();
  }

  async function loadVariants(product: Product) {
    setError("");

    const { data, error: variantError } = await supabase
      .from("product_variants")
      .select("id,name,sku,price")
      .eq("company_id", companyId)
      .eq("product_id", product.id);

    if (variantError) {
      setError(variantError.message);
      return;
    }

    const variants = await Promise.all((data || []).map(async (variant) => {
      const { data: stock, error: stockError } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("company_id", companyId)
        .eq("product_id", product.id)
        .eq("variant_id", variant.id)
        .maybeSingle();

      if (stockError) throw stockError;
      return { ...variant, inventory: stock ? [stock] : [] };
    }));

    setEditingVariantId(null);
    setVariantName("");
    setVariantSku("");
    setVariantPrice(String(product.price));
    setVariantQuantity("0");
    setVariantProduct({ ...product, variants });
  }

  async function showStockHistory(product: Product) {
    setHistoryProduct(product);
    setStockHistory([]);

    const { data: inventoryRows, error: inventoryError } = await supabase
      .from("inventory")
      .select("id")
      .eq("company_id", companyId)
      .eq("product_id", product.id)
      .is("variant_id", null);

    if (inventoryError) {
      setError(inventoryError.message);
      return;
    }

    const ids = (inventoryRows || []).map((row) => row.id);
    if (!ids.length) return;

    const { data, error: historyError } = await supabase
      .from("inventory_movements")
      .select("id,movement_type,quantity_change,reason,created_at")
      .in("inventory_id", ids)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (historyError) {
      setError(historyError.message);
      return;
    }

    setStockHistory(data || []);
  }

  async function archiveProduct(product: Product) {
    if (product.status === "archived") return;

    if (!window.confirm(`Archive "${product.name}"? Its inventory and stock history will be preserved.`)) {
      return;
    }

    setError("");

    const { error: archiveError } = await supabase
      .from("products")
      .update({ status: "archived" })
      .eq("id", product.id)
      .eq("company_id", companyId);

    if (archiveError) {
      setError(archiveError.message);
      return;
    }

    await loadProducts();
  }

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.sku || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const activeCount = products.filter((p) => p.status === "active").length;
  const lowStockCount = products.filter(
    (p) => (p.inventory?.[0]?.quantity ?? 0) <= (p.inventory?.[0]?.low_stock_threshold ?? 5)
  ).length;

  return (
    <main className="min-h-screen bg-[#080D18] p-5 text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/")}
              className="mb-4 flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold">Products</h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage your business products and inventory.
            </p>
          </div>

          <button
            onClick={openNewProduct}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold hover:bg-blue-500"
          >
            <Plus size={18} /> Add Product
          </button>
        </header>

        {error && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            <span>{error}</span>
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={18} />
            </button>
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-5">
            <div className="flex items-center justify-between text-slate-400">
              Total Products <Package size={19} />
            </div>
            <p className="mt-3 text-3xl font-bold">{products.length}</p>
          </div>
          <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-5">
            <div className="flex items-center justify-between text-slate-400">
              Active Products <Boxes size={19} />
            </div>
            <p className="mt-3 text-3xl font-bold">{activeCount}</p>
          </div>
          <div className="rounded-2xl border border-[#243149] bg-[#111C2F] p-5">
            <div className="flex items-center justify-between text-slate-400">
              Low Stock Items <Package size={19} />
            </div>
            <p className="mt-3 text-3xl font-bold">{lowStockCount}</p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-[#243149] bg-[#111C2F] p-5">
          <h2 className="mb-3 font-semibold">Categories</h2>
          <form
            onSubmit={(e) => { e.preventDefault(); void createCategory(); }}
            className="flex flex-wrap gap-3"
          >
            <input
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="New category name"
              maxLength={100}
              className="min-w-0 flex-1 rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 text-sm"
            />
            <button className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold">
              Add Category
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            {categories.map((c) => c.name).join(" • ") || "No categories yet"}
          </p>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#243149] bg-[#111C2F]">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#243149] p-5">
            <h2 className="font-semibold">Product Catalog</h2>
            <div className="relative w-full sm:w-72">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full rounded-xl border border-[#243149] bg-[#080D18] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-slate-400">
              <Loader2 className="animate-spin" size={20} /> Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="mx-auto mb-4 text-slate-500" size={38} />
              <h3 className="font-semibold">No products found</h3>
              <p className="mt-2 text-sm text-slate-400">
                Add your first product to start managing your catalog.
              </p>
              <button
                onClick={openNewProduct}
                className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold"
              >
                Add your first product
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#0D1422] text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-5 py-4">Product</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Price</th>
                    <th className="px-5 py-4">Stock</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-t border-[#243149] hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium">{product.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          SKU: {product.sku || "—"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {product.categories?.[0]?.name || "Uncategorized"}
                      </td>
                      <td className="px-5 py-4">
                        ৳{Number(product.price).toLocaleString("en-BD")}
                      </td>
                      <td className="px-5 py-4">
                        {product.inventory?.[0]?.quantity ?? 0}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs ${
                          product.status === "active"
                            ? "bg-green-500/10 text-green-400"
                            : product.status === "archived"
                              ? "bg-slate-500/10 text-slate-400"
                              : "bg-amber-500/10 text-amber-400"
                        }`}>
                          {product.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => void loadVariants(product)}
                            title="Manage variants"
                            className="rounded-lg px-2 py-2 text-xs text-violet-400 hover:bg-violet-500/10"
                          >
                            Variants
                          </button>
                          <button
                            onClick={() => void showStockHistory(product)}
                            title="Stock history"
                            className="rounded-lg px-2 py-2 text-xs text-cyan-400 hover:bg-cyan-500/10"
                          >
                            History
                          </button>
                          <button
                            onClick={() => openEditProduct(product)}
                            aria-label="Edit product"
                            className="rounded-lg p-2 text-slate-400 hover:bg-blue-500/10 hover:text-blue-400"
                          >
                            <Pencil size={16} />
                          </button>
                          {product.status === "archived" ? (
                            <button
                              onClick={() => restoreProduct(product)}
                              title="Restore product"
                              className="rounded-lg px-3 py-2 text-xs text-green-400 hover:bg-green-500/10"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => archiveProduct(product)}
                            aria-label="Archive product"
                            title="Archive product"
                            className="rounded-lg p-2 text-slate-400 hover:bg-amber-500/10 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Archive size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {variantProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <form onSubmit={createVariant} className="w-full max-w-lg rounded-2xl border border-[#243149] bg-[#111C2F] p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">{editingVariantId ? "Edit Variant" : "Add Variant"} — {variantProduct.name}</h2>
                <button type="button" onClick={() => setVariantProduct(null)}><X size={20} /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input required maxLength={100} value={variantName} onChange={e => setVariantName(e.target.value)} placeholder="Variant name (e.g. Red / Large)" className="rounded-xl border border-[#243149] bg-[#080D18] p-3 sm:col-span-2" />
                <input value={variantSku} onChange={e => setVariantSku(e.target.value)} placeholder="Variant SKU" className="rounded-xl border border-[#243149] bg-[#080D18] p-3" />
                <input required type="number" min="0" step="0.01" value={variantPrice} onChange={e => setVariantPrice(e.target.value)} placeholder="Price" className="rounded-xl border border-[#243149] bg-[#080D18] p-3" />
                <input required type="number" min="0" step="1" value={variantQuantity} onChange={e => setVariantQuantity(e.target.value)} placeholder="Initial stock" className="rounded-xl border border-[#243149] bg-[#080D18] p-3" />
              </div>
              <button className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold">{editingVariantId ? "Update Variant" : "Save Variant"}</button>
              <div className="mt-5 border-t border-[#243149] pt-4">
                <h3 className="mb-2 font-semibold">Existing Variants</h3>
                {(variantProduct.variants || []).map(v => (
                  <div key={v.id} className="flex justify-between border-b border-[#243149] py-2 text-sm">
                    <span>{v.name} <span className="text-slate-500">{v.sku || ""}</span></span>
                    <span className="flex items-center gap-3">
                      ৳{Number(v.price).toLocaleString("en-BD")} · {v.inventory?.[0]?.quantity ?? 0} in stock
                      <button
                        type="button"
                        onClick={() => {
                          setEditingVariantId(v.id);
                          setVariantName(v.name);
                          setVariantSku(v.sku || "");
                          setVariantPrice(String(v.price));
                          setVariantQuantity(String(v.inventory?.[0]?.quantity ?? 0));
                        }}
                        className="text-blue-400 hover:text-blue-300"
                      >Edit</button>
                    </span>
                  </div>
                ))}
                {!(variantProduct.variants || []).length && <p className="text-sm text-slate-400">No variants yet.</p>}
              </div>
            </form>
          </div>
        )}

        {historyProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#243149] bg-[#111C2F] p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">Stock History — {historyProduct.name}</h2>
                <button onClick={() => setHistoryProduct(null)}><X size={20} /></button>
              </div>
              {stockHistory.length ? stockHistory.map(item => (
                <div key={item.id} className="flex flex-wrap justify-between gap-2 border-b border-[#243149] py-3 text-sm">
                  <div><strong>{item.movement_type}</strong><p className="text-xs text-slate-400">{item.reason || "No reason"}</p></div>
                  <div className="text-right"><strong>{item.quantity_change > 0 ? "+" : ""}{item.quantity_change}</strong><p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</p></div>
                </div>
              )) : <p className="text-sm text-slate-400">No stock movement history found.</p>}
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
            <form
              onSubmit={saveProduct}
              className="my-8 w-full max-w-xl rounded-2xl border border-[#243149] bg-[#111C2F] p-6 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit Product" : "Add New Product"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-white"
                  aria-label="Close form"
                >
                  <X size={21} />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm sm:col-span-2">
                  Product Name *
                  <input
                    required
                    maxLength={150}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="e.g. Premium T-Shirt"
                  />
                </label>

                <label className="text-sm">
                  SKU
                  <input
                    maxLength={80}
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="SKU-001"
                  />
                </label>

                <label className="text-sm">
                  Price (BDT) *
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="1200"
                  />
                </label>

                <label className="text-sm">
                  Category
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 outline-none"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  Initial Stock *
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 outline-none"
                  />
                </label>

                <label className="text-sm">
                  Status
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>

                <label className="text-sm sm:col-span-2">
                  Description
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="mt-2 w-full rounded-xl border border-[#243149] bg-[#080D18] px-4 py-3 outline-none focus:border-blue-500"
                    placeholder="Product details..."
                  />
                </label>
              </div>

              <div className="mt-7 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-[#243149] px-5 py-3 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? "Saving..." : editingId ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
