"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { formatCurrency, formatDate } from "@/lib/utils";

type Product = {
  _id: Id<"products">;
  name: string;
  defaultPrice: number;
  isActive: boolean;
};

function SellSheet({
  product,
  currency,
  onClose,
}: {
  product: Product;
  currency: string;
  onClose: () => void;
}) {
  const createSale = useMutation(api.sales.create);
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(product.defaultPrice);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const total = qty * price;

  const confirm = async () => {
    setLoading(true);
    await createSale({
      productId: product._id,
      productName: product.name,
      unitPrice: price,
      quantity: qty,
    });
    setDone(true);
    setLoading(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 480, background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px calc(28px + env(safe-area-inset-bottom))",
          fontFamily: "var(--font)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🛒</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Venta registrada</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
              {qty}× {product.name} · {formatCurrency(total, currency)}
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 20, width: "100%", padding: "14px",
                background: "var(--pool-blue)", color: "#fff",
                border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)",
              }}
            >Listo</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{product.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
              Precio por unidad
            </div>

            {/* Price */}
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
              Precio unitario ({currency})
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "1.5px solid var(--border)", fontSize: 16,
                fontFamily: "var(--font)", marginBottom: 16,
                boxSizing: "border-box", background: "var(--surface)",
              }}
            />

            {/* Quantity */}
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 10 }}>
              Cantidad
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: "1.5px solid var(--border)",
                  background: "var(--surface)", fontSize: 20, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >−</button>
              <span style={{ fontSize: 24, fontWeight: 800, flex: 1, textAlign: "center" }}>{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                style={{
                  width: 44, height: 44, borderRadius: 12, border: "1.5px solid var(--border)",
                  background: "var(--surface)", fontSize: 20, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >+</button>
            </div>

            {/* Total */}
            <div style={{
              background: "var(--pool-light)", borderRadius: 14,
              padding: "14px 16px", display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16,
            }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--pool-blue)" }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--pool-blue)" }}>
                {formatCurrency(total, currency)}
              </span>
            </div>

            <button
              onClick={confirm}
              disabled={loading || total === 0}
              style={{
                width: "100%", padding: "14px",
                background: loading || total === 0 ? "var(--surface-2)" : "var(--paid-green)",
                color: loading || total === 0 ? "var(--text-secondary)" : "#fff",
                border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
                cursor: loading || total === 0 ? "default" : "pointer",
                fontFamily: "var(--font)",
              }}
            >{loading ? "Registrando…" : `Confirmar venta · ${formatCurrency(total, currency)}`}</button>
          </>
        )}
      </div>
    </div>
  );
}

function ProductFormSheet({
  initial,
  onClose,
  currency,
}: {
  initial?: Product;
  onClose: () => void;
  currency: string;
}) {
  const createProduct = useMutation(api.products.create);
  const updateProduct = useMutation(api.products.update);
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial?.defaultPrice ?? 0);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim() || price <= 0) return;
    setLoading(true);
    if (initial) {
      await updateProduct({ id: initial._id, name: name.trim(), defaultPrice: price });
    } else {
      await createProduct({ name: name.trim(), defaultPrice: price, isActive: true });
    }
    setLoading(false);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 480, background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px calc(28px + env(safe-area-inset-bottom))",
          fontFamily: "var(--font)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>
          {initial ? "Editar producto" : "Nuevo producto"}
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Gorra de natación"
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "1.5px solid var(--border)", fontSize: 15,
            fontFamily: "var(--font)", marginBottom: 16,
            boxSizing: "border-box", background: "var(--surface)",
          }}
        />
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>
          Precio ({currency})
        </label>
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: "1.5px solid var(--border)", fontSize: 15,
            fontFamily: "var(--font)", marginBottom: 20,
            boxSizing: "border-box", background: "var(--surface)",
          }}
        />
        <button
          onClick={save}
          disabled={loading || !name.trim() || price <= 0}
          style={{
            width: "100%", padding: "14px",
            background: loading || !name.trim() || price <= 0 ? "var(--surface-2)" : "var(--pool-blue)",
            color: loading || !name.trim() || price <= 0 ? "var(--text-secondary)" : "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: loading ? "default" : "pointer", fontFamily: "var(--font)",
          }}
        >{loading ? "Guardando…" : "Guardar"}</button>
      </div>
    </div>
  );
}

export default function VentasPage() {
  const [tab, setTab] = useState("vender");
  const [selling, setSelling] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null | "new">(null);

  const allProducts = useQuery(api.products.list, {});
  const sales = useQuery(api.sales.list);
  const updateProduct = useMutation(api.products.update);
  const config = useQuery(api.appConfig.getAll);
  const currency = config?.currency ?? "Bs";

  const activeProducts = useMemo(
    () => allProducts?.filter((p) => p.isActive) ?? [],
    [allProducts]
  );

  const todayStr = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().split("T")[0];

  const salesToday = sales?.filter((s) => s.date === todayStr) ?? [];
  const salesWeek = sales?.filter((s) => s.date >= weekStr) ?? [];
  const totalToday = salesToday.reduce((sum, s) => sum + s.total, 0);
  const totalWeek = salesWeek.reduce((sum, s) => sum + s.total, 0);

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 0", background: "var(--white)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Ventas</div>
          {tab === "productos" && (
            <button
              onClick={() => setEditProduct("new")}
              style={{
                background: "var(--pool-light)", borderRadius: 99, padding: "6px 14px",
                fontSize: 13, fontWeight: 700, color: "var(--pool-blue)",
                border: "none", cursor: "pointer", fontFamily: "var(--font)",
              }}
            >+ Nuevo</button>
          )}
        </div>
        <div style={{ paddingBottom: 12 }}>
          <SegmentedControl
            options={[
              { value: "vender", label: "Vender" },
              { value: "historial", label: "Historial" },
              { value: "productos", label: "Productos" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      {/* Vender tab */}
      {tab === "vender" && (
        <div style={{ padding: "16px 20px" }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px 16px", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>HOY</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--paid-green)" }}>{formatCurrency(totalToday, currency)}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{salesToday.length} ventas</div>
            </div>
            <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px 16px", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>ÚLTIMOS 7 DÍAS</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--pool-blue)" }}>{formatCurrency(totalWeek, currency)}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{salesWeek.length} ventas</div>
            </div>
          </div>

          {/* Product grid */}
          {!allProducts ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 90, borderRadius: 16, background: "var(--surface-2)" }} />
              ))}
            </div>
          ) : activeProducts.length === 0 ? (
            <EmptyState
              emoji="📦"
              title="Sin productos"
              description='Añade productos en la pestaña "Productos"'
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {activeProducts.map((p) => (
                <button
                  key={p._id}
                  onClick={() => setSelling(p)}
                  style={{
                    background: "var(--white)", borderRadius: 16, padding: "16px 14px",
                    boxShadow: "var(--shadow-card)", border: "none", cursor: "pointer",
                    textAlign: "left", fontFamily: "var(--font)",
                    transition: "box-shadow 0.15s",
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🛒</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.3 }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "var(--pool-blue)" }}>
                    {formatCurrency(p.defaultPrice, currency)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Historial tab */}
      {tab === "historial" && (
        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!sales ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ height: 68, borderRadius: 16, background: "var(--surface-2)" }} />
            ))
          ) : sales.length === 0 ? (
            <EmptyState emoji="📋" title="Sin ventas" description="Las ventas aparecerán aquí" />
          ) : (
            sales.map((s) => (
              <div
                key={s._id}
                style={{
                  background: "var(--white)", borderRadius: 16, padding: "14px 16px",
                  boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: "var(--pool-light)", display: "flex",
                  alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
                }}>🛒</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.productName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {s.quantity}× · {formatDate(s.date)}
                    {s.student ? ` · ${s.student.name}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", flexShrink: 0 }}>
                  {formatCurrency(s.total, currency)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Productos tab */}
      {tab === "productos" && (
        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          {!allProducts ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 68, borderRadius: 16, background: "var(--surface-2)" }} />
            ))
          ) : allProducts.length === 0 ? (
            <EmptyState emoji="📦" title="Sin productos" description="Toca + Nuevo para agregar" />
          ) : (
            allProducts.map((p) => (
              <div
                key={p._id}
                style={{
                  background: "var(--white)", borderRadius: 16, padding: "14px 16px",
                  boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: 12,
                  opacity: p.isActive ? 1 : 0.5,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--pool-blue)", fontWeight: 700, marginTop: 2 }}>
                    {formatCurrency(p.defaultPrice, currency)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => setEditProduct(p)}
                    style={{
                      padding: "6px 12px", borderRadius: 8,
                      border: "1.5px solid var(--border)", background: "transparent",
                      fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
                      cursor: "pointer", fontFamily: "var(--font)",
                    }}
                  >✏️</button>
                  <button
                    onClick={() => updateProduct({ id: p._id, isActive: !p.isActive })}
                    style={{
                      padding: "6px 12px", borderRadius: 8, border: "none",
                      background: p.isActive ? "var(--overdue-light)" : "var(--paid-light)",
                      color: p.isActive ? "var(--overdue-coral)" : "var(--paid-green)",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)",
                    }}
                  >{p.isActive ? "Pausar" : "Activar"}</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selling && (
        <SellSheet product={selling} currency={currency} onClose={() => setSelling(null)} />
      )}
      {editProduct && (
        <ProductFormSheet
          initial={editProduct === "new" ? undefined : editProduct}
          currency={currency}
          onClose={() => setEditProduct(null)}
        />
      )}
    </div>
  );
}
