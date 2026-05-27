"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "convex/react";
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

type WahaUiStatus = "loading" | "disconnected" | "qr_required" | "connected" | "error";
const WAHA_SESSION_NAME = "default";

type WahaDebugState = {
  configured: boolean;
  baseUrlHost: string | null;
  canReachWaha: boolean;
  sessionName: string;
  status: string | null;
  lastError: string | null;
};

type BatchSummary = {
  attempted: number;
  sent: number;
  failed: number;
  remaining: number;
};

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

function statusToUiStatus(status?: string | null): WahaUiStatus {
  if (status === "WORKING") return "connected";
  if (status === "SCAN_QR" || status === "SCAN_QR_CODE" || status === "STARTING" || status === "STARTED") {
    return "qr_required";
  }
  if (!status || status === "NOT_CREATED" || status === "STOPPED" || status === "FAILED") {
    return "disconnected";
  }
  return "disconnected";
}

async function readApiJson<T extends Record<string, unknown>>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const error = data && typeof data === "object" && "error" in data ? String(data.error) : `HTTP ${res.status}`;
    throw new Error(error);
  }
  return data as T;
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error desconocido";
}

export default function MarketingPage() {
  // 1. WhatsApp status states
  const [wahaStatus, setWahaStatus] = useState<WahaUiStatus>("loading");
  const [wahaRawStatus, setWahaRawStatus] = useState<string | null>(null);
  const [wahaDebug, setWahaDebug] = useState<WahaDebugState | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [loadingLogout, setLoadingLogout] = useState(false);

  // 2. Campaign Builder states
  const [segment, setSegment] = useState<"natacion" | "aquagym" | "all">("natacion");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // 3. Campaign details (Convex real-time queries)
  const campaigns = useQuery(api.marketing.listMarketingCampaigns);
  const latestCampaign = campaigns?.find((campaign) => campaign.status !== "done") ?? campaigns?.[0];
  const messages = useQuery(
    api.marketing.listCampaignMessages,
    latestCampaign ? { campaignId: latestCampaign._id } : "skip"
  );

  // 4. Action states
  const [testPhone, setTestPhone] = useState(
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_TEST_PHONE || "" : ""
  );
  const [testStudentName, setTestStudentName] = useState("Jorge Zaid Zeballos");
  const [testRecipientName, setTestRecipientName] = useState("Mabel Hiza");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchSummary, setBatchSummary] = useState<BatchSummary | null>(null);
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
      const data = await readApiJson<{
        online?: boolean;
        dryRun?: boolean;
        status?: string | null;
        lastError?: string | null;
      }>(res);
      
      setIsDryRun(!!data.dryRun);
      setWahaRawStatus(data.status ?? null);
      setQrMessage(data.lastError ?? null);

      if (data.online) {
        const nextStatus = statusToUiStatus(data.status);
        setWahaStatus(nextStatus);
        if (nextStatus === "connected") {
          setQrCode(null);
          setQrMessage("WhatsApp ya está conectado para esta sesión.");
        } else if (nextStatus === "qr_required") {
          fetchQrCode();
        }
      } else {
        setWahaStatus("error");
        setActionError(data.lastError || "No se pudo conectar con WAHA.");
      }
    } catch (err: unknown) {
      console.error(err);
      setWahaStatus("error");
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchWahaDebug = async () => {
    setLoadingStatus(true);
    setActionError(null);
    try {
      const res = await fetch("/api/mkt/whatsapp/debug", {
        headers: AUTH_HEADERS,
      });
      const data = await readApiJson<WahaDebugState>(res);
      setWahaDebug(data);
      setWahaRawStatus(data.status ?? null);
      setWahaStatus(data.canReachWaha ? statusToUiStatus(data.status) : "error");
      if (data.lastError) {
        setActionError(data.lastError);
      }
    } catch (err: unknown) {
      setWahaStatus("error");
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingStatus(false);
    }
  };

  const startSession = async () => {
    setLoadingStart(true);
    setActionError(null);
    setQrMessage(null);
    try {
      const res = await fetch("/api/mkt/whatsapp/start", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ sessionName: WAHA_SESSION_NAME }),
      });
      const data = await readApiJson<{ dryRun?: boolean }>(res);
      setIsDryRun(!!data.dryRun);
      await fetchWahaStatus();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingStart(false);
    }
  };

  const fetchQrCode = async () => {
    setLoadingQr(true);
    setActionError(null);
    setQrMessage(null);
    try {
      const res = await fetch("/api/mkt/whatsapp/qr", {
        headers: AUTH_HEADERS,
      });
      const data = await readApiJson<{
        qr?: string | null;
        status?: string | null;
        message?: string | null;
      }>(res);
      setWahaRawStatus(data.status ?? wahaRawStatus);
      if (data.qr) {
        setQrCode(data.qr);
        setWahaStatus("qr_required");
      } else {
        setQrCode(null);
        setQrMessage(data.message || "QR no disponible todavía. Inicia la sesión o intenta refrescar en unos segundos.");
        setWahaStatus(statusToUiStatus(data.status));
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setQrCode(null);
      setQrMessage(message);
      setActionError(message);
    } finally {
      setLoadingQr(false);
    }
  };

  const logoutSession = async () => {
    setLoadingLogout(true);
    setActionError(null);
    setQrCode(null);
    setQrMessage(null);
    try {
      const res = await fetch("/api/mkt/whatsapp/logout", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ sessionName: WAHA_SESSION_NAME }),
      });
      const data = await readApiJson<{ dryRun?: boolean; status?: string | null }>(res);
      setIsDryRun(!!data.dryRun);
      setWahaRawStatus(data.status ?? null);
      setWahaStatus(statusToUiStatus(data.status));
      await fetchWahaDebug();
    } catch (err: unknown) {
      setActionError(getErrorMessage(err));
    } finally {
      setLoadingLogout(false);
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
    } catch (err: unknown) {
      setActionError(`Error al crear campaña: ${getErrorMessage(err)}`);
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
          sessionName: WAHA_SESSION_NAME,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Error desconocido");
      }
      alert("Mensaje de prueba enviado con éxito.");
    } catch (err: unknown) {
      setActionError(`Error al enviar prueba: ${getErrorMessage(err)}`);
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
          sessionName: WAHA_SESSION_NAME,
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
    } catch (err: unknown) {
      setActionError(`Error al enviar tanda: ${getErrorMessage(err)}`);
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
    } catch (err: unknown) {
      setActionError(`Error al pausar/reanudar campaña: ${getErrorMessage(err)}`);
    } finally {
      setPausingCampaign(false);
    }
  };

  const getBadgeVariant = (status: string): BadgeVariant => {
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

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8, marginBottom: 16, fontSize: 12
          }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Conexión</div>
              <div style={{ color: "var(--text-primary)", fontWeight: 800 }}>
                {wahaDebug ? (wahaDebug.canReachWaha ? "Alcanzable" : "Sin conexión") : (wahaStatus === "loading" ? "Revisando" : "No verificado")}
              </div>
            </div>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 10px" }}>
              <div style={{ color: "var(--text-secondary)", fontWeight: 600 }}>Sesión</div>
              <div style={{ color: "var(--text-primary)", fontWeight: 800 }}>
                {WAHA_SESSION_NAME} · {wahaRawStatus || "Sin estado"}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <Button variant="outline" onClick={fetchWahaStatus} loading={loadingStatus} size="sm">
              Revisar conexión
            </Button>
            <Button variant="brand" onClick={startSession} loading={loadingStart} size="sm">
              Iniciar sesión
            </Button>
            <Button variant="outline" onClick={fetchQrCode} loading={loadingQr} size="sm">
              Actualizar QR
            </Button>
            <Button variant="outline" onClick={fetchWahaDebug} loading={loadingStatus} size="sm">
              Diagnóstico
            </Button>
            <Button variant="danger" onClick={logoutSession} loading={loadingLogout} size="sm">
              Cerrar sesión
            </Button>
          </div>

          {wahaDebug?.lastError && (
            <div style={{
              background: "#FFF7ED", color: "#9A3412", border: "1.5px solid #FDBA74",
              borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 600,
              marginBottom: 14, lineHeight: 1.4
            }}>
              {wahaDebug.lastError}
            </div>
          )}

          {loadingQr && (
            <div style={{
              background: "var(--surface)", color: "var(--text-secondary)",
              border: "1.5px solid var(--border)", borderRadius: 12,
              padding: "12px 14px", fontSize: 13, fontWeight: 600, marginBottom: 14
            }}>
              Cargando código QR...
            </div>
          )}

          {qrMessage && !qrCode && (
            <div style={{
              background: "#EFF6FF", color: "#1E40AF", border: "1.5px solid #93C5FD",
              borderRadius: 12, padding: "10px 12px", fontSize: 12, fontWeight: 600,
              marginBottom: 14, lineHeight: 1.4
            }}>
              {qrMessage}
            </div>
          )}

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
              onChange={(v) => setSegment(v as "natacion" | "aquagym" | "all")}
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
