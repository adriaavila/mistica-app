"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SegmentedControl from "@/components/ui/SegmentedControl";
import Badge from "@/components/ui/Badge";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) {
    return "***";
  }
  const startLen = digits.length >= 12 ? 5 : 4;
  const start = digits.substring(0, startLen);
  const end = digits.substring(digits.length - 4);
  return `${start}***${end}`;
}

const AUTH_HEADERS = {
  "Authorization": "Bearer Mistica-Admin246",
  "Content-Type": "application/json",
};

export default function MarketingPage() {
  // 1. WhatsApp status states
  const [wahaStatus, setWahaStatus] = useState<string>("loading"); // loading, disconnected, qr_required, connected, error
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);

  // 2. Campaign Builder states
  const [segment, setSegment] = useState<"natacion" | "aquagym" | "all">("natacion");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // 3. Campaign details (Convex real-time queries)
  const campaigns = useQuery(api.marketing.listMarketingCampaigns);
  const latestCampaign = campaigns?.[0];
  const messages = useQuery(
    api.marketing.listCampaignMessages,
    latestCampaign ? { campaignId: latestCampaign._id } : "skip" as any
  );

  // 4. Action states
  const [testPhone, setTestPhone] = useState(
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_TEST_PHONE || "" : ""
  );
  const [testStudentName, setTestStudentName] = useState("Jorge Zaid Zeballos");
  const [testRecipientName, setTestRecipientName] = useState("Mabel Hiza");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchSummary, setBatchSummary] = useState<any | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState<boolean>(false);
  const [pausingCampaign, setPausingCampaign] = useState(false);

  // Fetch status on mount
  useEffect(() => {
    fetchWahaStatus();
  }, []);

  const fetchWahaStatus = async () => {
    setLoadingStatus(true);
    setActionError(null);
    try {
      const res = await fetch("/api/mkt/whatsapp/status", {
        headers: AUTH_HEADERS,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      
      setIsDryRun(!!data.dryRun);

      if (data.online) {
        const misticaSession = data.sessions?.find((s: any) => s.name === "default");
        if (!misticaSession) {
          setWahaStatus("disconnected");
        } else if (misticaSession.status === "WORKING") {
          setWahaStatus("connected");
          setQrCode(null);
        } else if (
          misticaSession.status === "SCAN_QR" ||
          misticaSession.status === "SCAN_QR_CODE" ||
          misticaSession.status === "STARTING"
        ) {
          setWahaStatus("qr_required");
          // Proactively fetch QR
          fetchQrCode();
        } else {
          setWahaStatus("disconnected");
        }
      } else {
        setWahaStatus("error");
      }
    } catch (err: any) {
      console.error(err);
      setWahaStatus("error");
    } finally {
      setLoadingStatus(false);
    }
  };

  const startSession = async () => {
    setLoadingStart(true);
    setActionError(null);
    try {
      const res = await fetch("/api/mkt/whatsapp/start", {
        method: "POST",
        headers: AUTH_HEADERS,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setIsDryRun(!!data.dryRun);
      await fetchWahaStatus();
    } catch (err: any) {
      setActionError(`Error al iniciar sesión: ${err.message}`);
    } finally {
      setLoadingStart(false);
    }
  };

  const fetchQrCode = async () => {
    setLoadingQr(true);
    try {
      const res = await fetch("/api/mkt/whatsapp/qr", {
        headers: AUTH_HEADERS,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.qr) {
        setQrCode(data.qr);
        setWahaStatus("qr_required");
      } else {
        setQrCode(null);
      }
    } catch (err) {
      console.error("Failed to fetch QR:", err);
    } finally {
      setLoadingQr(false);
    }
  };

  const handleCreateCampaign = async () => {
    setCreatingCampaign(true);
    setActionError(null);
    try {
      const res = await fetch("/api/mkt/campaigns/mothers-day", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ segment }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setBatchSummary(null);
      alert(`Campaña creada. Se prepararon ${data.preparedCount} mensajes en cola.`);
    } catch (err: any) {
      setActionError(`Error al crear campaña: ${err.message}`);
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      alert("Por favor ingresa un número de teléfono de prueba.");
      return;
    }
    setSendingTest(true);
    setActionError(null);
    try {
      const res = await fetch("/api/mkt/send-test", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          phone: testPhone,
          program: segment === "all" ? "natacion" : segment,
          studentName: testStudentName,
          recipientName: testRecipientName,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error desconocido");
      }
      alert("Mensaje de prueba enviado con éxito.");
    } catch (err: any) {
      setActionError(`Error al enviar prueba: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendBatch = async (limit: number) => {
    if (!latestCampaign) return;
    if (wahaStatus !== "connected") {
      alert("Debes conectar WhatsApp primero.");
      return;
    }
    setSendingBatch(true);
    setActionError(null);
    setBatchSummary(null);
    try {
      const res = await fetch("/api/mkt/send-batch", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          campaignId: latestCampaign._id,
          limit,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error desconocido");
      }
      const data = await res.json();
      if (data.success) {
        setBatchSummary(data.summary);
      }
    } catch (err: any) {
      setActionError(`Error al enviar tanda: ${err.message}`);
    } finally {
      setSendingBatch(false);
    }
  };

  const handlePauseResumeCampaign = async (paused: boolean) => {
    if (!latestCampaign) return;
    setPausingCampaign(true);
    setActionError(null);
    try {
      const res = await fetch("/api/mkt/campaigns/pause", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          campaignId: latestCampaign._id,
          paused,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error al cambiar estado");
      }
    } catch (err: any) {
      setActionError(`Error al pausar/reanudar campaña: ${err.message}`);
    } finally {
      setPausingCampaign(false);
    }
  };

  const getBadgeVariant = (status: string): any => {
    switch (status) {
      case "draft": return "pending";
      case "ready": return "active";
      case "sending": return "active";
      case "paused": return "suspended";
      case "done": return "paid";
      case "error": return "overdue";
      default: return "withdrawn";
    }
  };

  const getBadgeLabel = (status: string): string => {
    switch (status) {
      case "draft": return "Borrador";
      case "ready": return "Lista";
      case "sending": return "Enviando";
      case "paused": return "Pausada";
      case "done": return "Completada";
      case "error": return "Error";
      default: return status;
    }
  };

  // Preview messages copy helpers
  const natPreviewText = `Hola 💙\n\nDe parte de Mística Natación & Aquagym queremos enviar un saludo especial por el Día de la Madre.\n\nGracias por acompañar el proceso de Jorge Zaid Zeballos con tanto amor, constancia y confianza. Para nosotros es muy especial ver cómo cada alumno crece, aprende y gana seguridad en el agua 🌊\n\nCon cariño,\nEquipo Mística`;
  const aquaPreviewText = `Hola Mabel Hiza 💙\n\nEn Mística Natación & Aquagym queremos enviarte un saludo especial por el Día de la Madre.\n\nGracias por ser parte de nuestra comunidad y por compartir con nosotras momentos de salud, movimiento, bienestar y alegría en el agua 🌊\n\nCon cariño,\nEquipo Mística`;

  // Calculated totals for campaign
  const totals = messages ? {
    pending: messages.filter((m) => m.status === "pending").length,
    sent: messages.filter((m) => m.status === "sent").length,
    error: messages.filter((m) => m.status === "error").length,
    skipped: messages.filter((m) => m.status === "skipped").length,
    total: messages.length,
  } : { pending: 0, sent: 0, error: 0, skipped: 0, total: 0 };

  return (
    <div style={{ fontFamily: "var(--font)", background: "var(--surface)", minHeight: "100vh" }}>
      <PageHeader
        title="Campañas WhatsApp"
        subtitle="Envía mensajes controlados por el Día de la Madre."
        back={true}
      />

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
        {actionError && (
          <div style={{
            background: "#FEE2E2", color: "#B91C1C", border: "1.5px solid #FCA5A5",
            borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 600
          }}>
            ⚠️ {actionError}
          </div>
        )}

        {isDryRun && (
          <div style={{
            background: "#EFF6FF", color: "#1E40AF", border: "1.5px solid #93C5FD",
            borderRadius: 12, padding: "12px 16px", fontSize: 13, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 8
          }}>
            ⚙️ MODO SIMULACIÓN (DRY RUN) - El envío real a través de WhatsApp está desactivado. Las operaciones simulan el flujo exitoso.
          </div>
        )}

        {/* SECTION 1: WhatsApp Connection Card */}
        <Card padding="20px">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Conexión WhatsApp</div>
            <div>
              {wahaStatus === "connected" && <Badge variant="active" label="Conectado" />}
              {wahaStatus === "qr_required" && <Badge variant="suspended" label="Escanear QR" />}
              {wahaStatus === "disconnected" && <Badge variant="withdrawn" label="Desconectado" />}
              {wahaStatus === "error" && <Badge variant="withdrawn" label="Error Servidor" />}
              {wahaStatus === "loading" && <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Cargando...</span>}
            </div>
          </div>

          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 16px" }}>
            Vincular una línea telefónica a través del escaneo de código QR para habilitar el envío automatizado de mensajes WhatsApp.
          </p>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {wahaStatus !== "connected" && wahaStatus !== "qr_required" && (
              <Button variant="brand" onClick={startSession} loading={loadingStart} size="sm">
                Iniciar sesión de WhatsApp
              </Button>
            )}
            {wahaStatus === "qr_required" && (
              <Button variant="outline" onClick={fetchQrCode} loading={loadingQr} size="sm">
                Actualizar Código QR
              </Button>
            )}
            <Button variant="outline" onClick={fetchWahaStatus} loading={loadingStatus} size="sm">
              Refrescar Estado
            </Button>
          </div>

          {/* QR Render wrapper */}
          {wahaStatus === "qr_required" && qrCode && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              padding: 20, background: "var(--white)", borderRadius: 16,
              border: "1.5px solid var(--border)", margin: "16px 0"
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                Abre WhatsApp &gt; Dispositivos vinculados &gt; Vincular dispositivo:
              </span>
              <img src={qrCode} alt="WhatsApp QR Code" style={{ width: 200, height: 200, display: "block" }} />
            </div>
          )}

          {/* Warning banner */}
          <div style={{
            background: "rgba(245, 158, 11, 0.08)", color: "#D97706",
            borderRadius: 12, padding: "10px 14px", fontSize: 12,
            fontWeight: 500, lineHeight: 1.4, display: "flex", gap: 8
          }}>
            <span>⚠️</span>
            <span>No cierres la sesión de WhatsApp en tu celular mientras se realizan los envíos.</span>
          </div>
        </Card>

        {/* SECTION 2: Campaign Builder Card */}
        <Card padding="20px">
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
            Creador de Campaña (Día de la Madre)
          </div>

          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
            Segmento objetivo
          </label>
          <div style={{ marginBottom: 16 }}>
            <SegmentedControl
              options={[
                { value: "natacion", label: "Natación" },
                { value: "aquagym", label: "Aquagym" },
                { value: "all", label: "Todos" },
              ]}
              value={segment}
              onChange={(v) => setSegment(v as any)}
              fullWidth={true}
            />
          </div>

          {/* Message Preview wrapper */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>
              Vista previa del mensaje
            </label>
            <div style={{
              background: "#E4F2E6", borderRadius: 14, padding: 14,
              border: "1px solid #C5E3CA", fontFamily: "var(--font)",
              fontSize: 13, color: "#1A251C", whiteSpace: "pre-wrap",
              lineHeight: 1.4, position: "relative",
              boxShadow: "rgba(0,0,0,0.03) 0px 1px 3px"
            }}>
              <div style={{
                position: "absolute", left: -6, top: 12, width: 0, height: 0,
                borderStyle: "solid", borderWidth: "6px 8px 6px 0",
                borderColor: "transparent #E4F2E6 transparent transparent"
              }} />
              {segment === "natacion" && natPreviewText}
              {segment === "aquagym" && aquaPreviewText}
              {segment === "all" && (
                <>
                  <strong style={{ display: "block", color: "#0B84C7", marginBottom: 6, fontSize: 11 }}>
                    [Vista previa: Natación]
                  </strong>
                  {natPreviewText}
                  <div style={{ height: 1, background: "rgba(0,0,0,0.08)", margin: "14px 0" }} />
                  <strong style={{ display: "block", color: "#0B84C7", marginBottom: 6, fontSize: 11 }}>
                    [Vista previa: Aquagym]
                  </strong>
                  {aquaPreviewText}
                </>
              )}
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleCreateCampaign}
            loading={creatingCampaign}
            fullWidth={true}
          >
            Configurar y Preparar Campaña
          </Button>
        </Card>

        {/* SECTION 3: Campaign Details & Dispatch */}
        {latestCampaign ? (
          <Card padding="20px">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Campaña Activa</div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{latestCampaign.name}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Badge variant={getBadgeVariant(latestCampaign.status)} label={getBadgeLabel(latestCampaign.status)} size="sm" />
                {(latestCampaign.status === "ready" || latestCampaign.status === "sending") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePauseResumeCampaign(true)}
                    loading={pausingCampaign}
                  >
                    Pausar
                  </Button>
                )}
                {latestCampaign.status === "paused" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handlePauseResumeCampaign(false)}
                    loading={pausingCampaign}
                  >
                    Reanudar
                  </Button>
                )}
              </div>
            </div>

            {/* Premium Stat cards */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10, marginBottom: 20
            }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{totals.pending}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>En cola (Pendientes)</div>
              </div>
              <div style={{ background: "#ECFDF5", border: "1px solid #D1FAE5", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#065F46" }}>{totals.sent}</div>
                <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>Enviados</div>
              </div>
              <div style={{ background: "#FEF2F2", border: "1px solid #FEE2E2", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#991B1B" }}>{totals.error}</div>
                <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 2 }}>Errores / Fallidos</div>
              </div>
              <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-secondary)" }}>{totals.total}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Total destinatarios</div>
              </div>
            </div>

            {/* Batch summary logs */}
            {batchSummary && (
              <div style={{
                background: "#F0FDF4", border: "1.5px solid #BBF7D0",
                borderRadius: 12, padding: "12px 16px", marginBottom: 20,
                fontSize: 13, color: "#166534"
              }}>
                <strong style={{ display: "block", marginBottom: 4 }}>Resumen de envío de tanda completado:</strong>
                <div>Intentados: {batchSummary.attempted} · Enviados: {batchSummary.sent} · Errores: {batchSummary.failed}</div>
                <div style={{ fontSize: 11, color: "#15803d", marginTop: 2 }}>Mensajes restantes en cola: {batchSummary.remaining}</div>
              </div>
            )}

            {/* TEST SEND BLOCK */}
            <div style={{
              border: "1.5px solid var(--border)", borderRadius: 14,
              padding: 14, marginBottom: 20, background: "var(--white)"
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Enviar Prueba de WhatsApp</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Input
                  label="Número de prueba (con código de país, ej. 59171234567)"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="Ej: 59171234567"
                  type="tel"
                />
                {segment === "natacion" && (
                  <Input
                    label="Nombre Alumno (muestra)"
                    value={testStudentName}
                    onChange={(e) => setTestStudentName(e.target.value)}
                  />
                )}
                {segment === "aquagym" && (
                  <Input
                    label="Nombre Recipiente (muestra)"
                    value={testRecipientName}
                    onChange={(e) => setTestRecipientName(e.target.value)}
                  />
                )}
                <Button
                  variant="outline"
                  onClick={handleSendTest}
                  loading={sendingTest}
                  disabled={sendingBatch}
                  size="sm"
                >
                  🚀 Enviar mensaje de prueba
                </Button>
              </div>
            </div>

            {/* BATCH SEND ACTION BLOCK */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Despacho en Tandas</div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 12px" }}>
                Recomendamos realizar envíos en tandas pequeñas. Los mensajes se envían con una pausa humana aleatoria de 25-60 segundos entre cada uno para proteger la línea contra bloqueos.
              </p>
              
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  variant="brand"
                  onClick={() => handleSendBatch(10)}
                  loading={sendingBatch}
                  disabled={sendingTest || totals.pending === 0 || latestCampaign.status === "paused"}
                  style={{ flex: 1 }}
                >
                  Enviar 10 mensajes
                </Button>
                <Button
                  variant="brand"
                  onClick={() => handleSendBatch(25)}
                  loading={sendingBatch}
                  disabled={sendingTest || totals.pending === 0 || latestCampaign.status === "paused"}
                  style={{ flex: 1 }}
                >
                  Enviar 25 mensajes
                </Button>
              </div>
            </div>

            {/* RECIPIENTS MESSAGE LIST TABLE */}
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
                Destinatarios ({totals.total})
              </div>
              <div style={{
                maxHeight: 280, overflowY: "auto", border: "1.5px solid var(--border)",
                borderRadius: 12, background: "var(--white)"
              }}>
                {messages && messages.length > 0 ? (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-secondary)" }}>Nombre</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-secondary)" }}>Teléfono</th>
                        <th style={{ padding: "10px 12px", fontWeight: 700, color: "var(--text-secondary)" }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {messages.map((m) => {
                        let statusColor = "var(--text-secondary)";
                        let statusLabel: string = m.status;
                        if (m.status === "sent") { statusColor = "var(--paid-green)"; statusLabel = "Enviado"; }
                        else if (m.status === "pending") { statusColor = "var(--pending-amber)"; statusLabel = "En cola"; }
                        else if (m.status === "sending") { statusColor = "var(--pool-blue)"; statusLabel = "Enviando"; }
                        else if (m.status === "error") { statusColor = "var(--overdue-coral)"; statusLabel = "Error"; }
                        else if (m.status === "skipped") { statusColor = "gray"; statusLabel = "Omitido"; }

                        return (
                          <tr key={m._id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.recipientName || "—"}</div>
                              {m.studentName && m.recipientName !== m.studentName && (
                                <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                                  Alumno: {m.studentName}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                              {maskPhone(m.normalizedPhone)}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontWeight: 700, color: statusColor }}>{statusLabel}</span>
                              {m.error && (
                                <div style={{ fontSize: 10, color: "var(--overdue-coral)", marginTop: 2, wordBreak: "break-all" }}>
                                  {m.error}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: "32px 16px", textDecoration: "none", color: "var(--text-secondary)", textAlign: "center" }}>
                    Cargando destinatarios...
                  </div>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card padding="32px 16px" style={{ textAlign: "center" }}>
            <span style={{ fontSize: 32, display: "block", marginBottom: 8 }}>📣</span>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Sin campaña configurada</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Configura y crea una campaña arriba para empezar a preparar destinatarios.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
