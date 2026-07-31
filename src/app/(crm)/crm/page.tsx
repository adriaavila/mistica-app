"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import EmptyState from "@/components/ui/EmptyState";

function timeLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  return sameDay
    ? d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" });
}

const KIND_LABEL: Record<string, string> = {
  cliente: "Cliente",
  interesado: "Interesado",
  otro: "Otro",
};

const KIND_COLOR: Record<string, { bg: string; fg: string }> = {
  cliente: { bg: "var(--paid-light)", fg: "var(--paid-green)" },
  interesado: { bg: "var(--pending-light)", fg: "var(--pending-amber)" },
  otro: { bg: "var(--surface-2)", fg: "var(--text-secondary)" },
};

function ConversationList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const conversations = useQuery(api.crm.listConversations, {});

  if (conversations === undefined) {
    return <div style={{ padding: 20, color: "var(--text-secondary)", fontSize: 14 }}>Cargando…</div>;
  }

  if (conversations.length === 0) {
    return (
      <div style={{ padding: 20 }}>
        <EmptyState
          emoji="✉"
          title="Sin conversaciones"
          description="Los mensajes de WhatsApp aparecerán aquí en cuanto lleguen."
        />
      </div>
    );
  }

  return (
    <div>
      {conversations.map((c) => {
        const active = c._id === selectedId;
        const color = KIND_COLOR[c.contactKind] ?? KIND_COLOR.otro;
        return (
          <button
            key={c._id}
            type="button"
            onClick={() => onSelect(c._id)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "12px 16px", border: "none",
              borderBottom: "1px solid var(--border)",
              background: active ? "var(--pool-light)" : "transparent",
              fontFamily: "var(--font)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700,
                color: "var(--text-primary)", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.contactName || c.contactPhone}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-secondary)", flexShrink: 0 }}>
                {timeLabel(c.lastMessageAt)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                flex: 1, minWidth: 0, fontSize: 13, color: "var(--text-secondary)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {c.lastMessagePreview}
              </span>
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700, padding: "2px 6px",
                borderRadius: 99, background: color.bg, color: color.fg,
              }}>
                {KIND_LABEL[c.contactKind] ?? "Otro"}
              </span>
              {c.needsReply && (
                <span
                  title="Sin responder"
                  style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 99, background: "var(--overdue-coral)" }}
                />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Thread({ conversationId }: { conversationId: Id<"conversations"> }) {
  const messages = useQuery(api.crm.listMessages, { conversationId });
  const detail = useQuery(api.crm.getConversation, { conversationId });
  const sendReply = useAction(api.crm.sendReply);
  const markRead = useMutation(api.crm.markRead);
  const takeOver = useMutation(api.crm.takeOverConversation);
  const resumeAgent = useMutation(api.crm.resumeAgent);
  const setOwnership = useMutation(api.crm.setConversationOwnership);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markRead({ conversationId }).catch(() => {});
  }, [conversationId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    const result = await sendReply({ conversationId, text: trimmed });
    setSending(false);
    if (result.ok) setText("");
    else setError(result.error ?? "No se pudo enviar");
  };

  const ownership = detail?.conversation.ownershipState ?? "HUMAN_ACTIVE";

  return (
    <div className="flex h-[100dvh] flex-col">
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid var(--border)",
        background: "var(--white)", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            {detail?.contact.displayName || detail?.contact.normalizedPhone || "…"}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
            {ownership === "HUMAN_ACTIVE" ? "Humano" : ownership === "AGENT_ACTIVE" ? "Agente" : ownership}
          </span>
          {ownership !== "HUMAN_ACTIVE" && (
            <button type="button" onClick={() => void takeOver({ conversationId })}>Tomar control</button>
          )}
          {ownership === "HUMAN_ACTIVE" && (
            <button type="button" onClick={() => void resumeAgent({ conversationId })}>Activar agente</button>
          )}
          {ownership !== "PAUSED" && (
            <button type="button" onClick={() => void setOwnership({ conversationId, state: "PAUSED" })}>Pausar</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {detail?.students.length
            ? detail.students.map((s) => s.name).join(" · ")
            : detail?.contact.normalizedPhone}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
        {messages === undefined && (
          <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Cargando…</div>
        )}
        {messages?.map((m) => {
          const mine = m.direction === "out";
          return (
            <div key={m._id} style={{
              display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10,
            }}>
              <div style={{
                maxWidth: "min(560px, 78%)", padding: "9px 13px", borderRadius: 16,
                background: mine ? "var(--pool-blue)" : "var(--white)",
                color: mine ? "#fff" : "var(--text-primary)",
                boxShadow: "var(--shadow-card)", fontSize: 14, lineHeight: 1.45,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {m.mediaUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.mediaUrl}
                    alt="Adjunto"
                    style={{ maxWidth: "100%", borderRadius: 10, marginBottom: m.body ? 6 : 0, display: "block" }}
                  />
                )}
                {m.hasMedia && !m.mediaUrl && (
                  <div style={{
                    fontSize: 12, fontStyle: "italic",
                    color: mine ? "rgba(255,255,255,0.85)" : "var(--text-secondary)",
                    marginBottom: m.body ? 6 : 0,
                  }}>
                    {m.mediaError ?? "Descargando adjunto…"}
                  </div>
                )}
                {m.body}
                <div style={{
                  fontSize: 10, marginTop: 4, textAlign: "right",
                  color: mine ? "rgba(255,255,255,0.75)" : "var(--text-secondary)",
                }}>
                  {timeLabel(m.timestamp)}
                  {mine && m.ack === 3 && " ✓✓"}
                  {mine && m.ack === 2 && " ✓✓"}
                  {mine && m.ack === 1 && " ✓"}
                  {m.sendError && " ⚠"}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{
        borderTop: "1px solid var(--border)", background: "var(--white)",
        padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", flexShrink: 0,
      }}>
        {error && (
          <div style={{ color: "var(--overdue-coral)", fontSize: 12, marginBottom: 8 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={ownership === "HUMAN_ACTIVE" ? "Escribe un mensaje…" : "Toma el control humano para responder"}
            rows={1}
            disabled={ownership !== "HUMAN_ACTIVE"}
            aria-label="Respuesta de WhatsApp"
            style={{
              flex: 1, resize: "none", maxHeight: 120, padding: "10px 14px",
              borderRadius: 20, border: "1px solid var(--border)",
              fontFamily: "var(--font)", fontSize: 14, lineHeight: 1.4,
              outline: "none", background: "var(--surface)",
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={ownership !== "HUMAN_ACTIVE" || sending || !text.trim()}
            style={{
              flexShrink: 0, height: 40, padding: "0 18px", borderRadius: 20, border: "none",
              background: sending || !text.trim() ? "var(--surface-2)" : "var(--pool-blue)",
              color: sending || !text.trim() ? "var(--text-disabled)" : "#fff",
              fontFamily: "var(--font)", fontSize: 14, fontWeight: 700,
            }}
          >
            {sending ? "…" : "Enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("c");

  const select = (id: string) => {
    router.replace(`/crm?c=${id}`);
  };

  return (
    <div className="lg:grid lg:h-[100dvh] lg:grid-cols-[340px_1fr]">
      {/* Mobile: the list is the page until a chat is opened. */}
      <div
        className={`${selectedId ? "hidden lg:block" : "block"} lg:h-[100dvh] lg:overflow-y-auto`}
        style={{ background: "var(--white)", borderRight: "1px solid var(--border)" }}
      >
        <div style={{
          padding: "16px 16px 12px", borderBottom: "1px solid var(--border)",
          position: "sticky", top: 0, background: "var(--white)", zIndex: 1,
        }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>Chats</h1>
        </div>
        <ConversationList selectedId={selectedId} onSelect={select} />
      </div>

      <div className={selectedId ? "block" : "hidden lg:block"}>
        {selectedId ? (
          <>
            <button
              type="button"
              onClick={() => router.replace("/crm")}
              className="lg:hidden"
              style={{
                border: "none", background: "var(--white)", width: "100%", textAlign: "left",
                padding: "10px 16px", borderBottom: "1px solid var(--border)",
                fontFamily: "var(--font)", fontSize: 14, color: "var(--pool-blue)", fontWeight: 600,
              }}
            >
              ‹ Chats
            </button>
            <Thread conversationId={selectedId as Id<"conversations">} />
          </>
        ) : (
          <div className="hidden h-[100dvh] items-center justify-center lg:flex">
            <EmptyState
              emoji="✉"
              title="Elige una conversación"
              description="Selecciona un chat de la lista para ver los mensajes."
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CrmPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20, color: "var(--text-secondary)" }}>Cargando…</div>}>
      <Inbox />
    </Suspense>
  );
}
