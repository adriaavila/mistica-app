"use client";
/* eslint-disable @next/next/no-img-element -- previews use blob, data, and Convex storage URLs */

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  History,
  ImagePlus,
  LoaderCircle,
  MessageCircle,
  Pause,
  Play,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import styles from "./page.module.css";

// Auth rides on the httpOnly session cookie (same-origin); no bearer token in the client.
const AUTH_HEADERS = {
  "Content-Type": "application/json",
};
const WAHA_SESSION_NAME = "default";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type View = "compose" | "history";
type Segment = "natacion" | "aquagym" | "all";
type WahaUiStatus = "loading" | "disconnected" | "qr_required" | "connected" | "error";

type WahaDebugState = {
  configured: boolean;
  baseUrlHost: string | null;
  canReachWaha: boolean;
  sessionName: string;
  status: string | null;
  lastError: string | null;
};

type BatchProgress = {
  target: number;
  completed: number;
  sent: number;
  failed: number;
  remaining: number;
  waitingSeconds: number;
};

function statusToUiStatus(status?: string | null): WahaUiStatus {
  if (status === "WORKING") return "connected";
  if (["SCAN_QR", "SCAN_QR_CODE", "STARTING", "STARTED"].includes(status ?? "")) {
    return "qr_required";
  }
  return "disconnected";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

async function readApiJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data
      ? String(data.error)
      : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) return "***";
  return `${digits.slice(0, 4)}***${digits.slice(-4)}`;
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Sin destinatarios",
    ready: "Lista para enviar",
    sending: "En progreso",
    paused: "Pausada",
    done: "Completada",
    error: "Con errores",
  };
  return labels[status] ?? status;
}

function segmentLabel(segment: Segment) {
  return segment === "natacion" ? "Natación" : segment === "aquagym" ? "Aquagym" : "Toda la comunidad";
}

function renderPreview(message: string) {
  return message
    .replaceAll("{{nombre}}", "Mabel Hiza")
    .replaceAll("{{alumno}}", "Jorge Zaid");
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export default function MarketingPage() {
  const [view, setView] = useState<View>("compose");
  const [selectedCampaignId, setSelectedCampaignId] = useState<Id<"marketingCampaigns"> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [wahaStatus, setWahaStatus] = useState<WahaUiStatus>("loading");
  const [wahaRawStatus, setWahaRawStatus] = useState<string | null>(null);
  const [wahaDebug, setWahaDebug] = useState<WahaDebugState | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [connectionLoading, setConnectionLoading] = useState<string | null>(null);
  const [isDryRun, setIsDryRun] = useState(false);

  const [name, setName] = useState("");
  const [segment, setSegment] = useState<Segment>("natacion");
  const [message, setMessage] = useState("Hola {{nombre}} 💙\n\n");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [testPhone, setTestPhone] = useState(
    typeof window !== "undefined" ? process.env.NEXT_PUBLIC_TEST_PHONE || "" : ""
  );
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [pausingCampaign, setPausingCampaign] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stopBatchRef = useRef(false);

  const campaigns = useQuery(api.marketing.listMarketingCampaigns);
  const generateUploadUrl = useMutation(api.marketing.generateMarketingImageUploadUrl);
  const selectedCampaign = campaigns?.find((campaign) => campaign._id === selectedCampaignId) ?? null;
  const messages = useQuery(
    api.marketing.listCampaignMessages,
    selectedCampaignId ? { campaignId: selectedCampaignId } : "skip"
  );

  const totals = useMemo(() => {
    const campaignMessages = messages ?? [];
    return {
      total: campaignMessages.length,
      pending: campaignMessages.filter((item) => item.status === "pending").length,
      sent: campaignMessages.filter((item) => item.status === "sent").length,
      error: campaignMessages.filter((item) => item.status === "error").length,
      skipped: campaignMessages.filter((item) => item.status === "skipped").length,
    };
  }, [messages]);

  const fetchWahaStatus = useCallback(async () => {
    setConnectionLoading("status");
    setActionError(null);
    try {
      const response = await fetch("/api/mkt/whatsapp/status", { headers: AUTH_HEADERS });
      const data = await readApiJson<{
        online?: boolean;
        dryRun?: boolean;
        status?: string | null;
        lastError?: string | null;
      }>(response);
      setIsDryRun(Boolean(data.dryRun));
      setWahaRawStatus(data.status ?? null);
      setQrMessage(data.lastError ?? null);
      setWahaStatus(data.online ? statusToUiStatus(data.status) : "error");
    } catch (error) {
      setWahaStatus("error");
      setActionError(getErrorMessage(error));
    } finally {
      setConnectionLoading(null);
    }
  }, []);

  useEffect(() => {
    void fetchWahaStatus();
  }, [fetchWahaStatus]);

  useEffect(() => {
    return () => {
      stopBatchRef.current = true;
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const startSession = async () => {
    setConnectionLoading("start");
    setActionError(null);
    try {
      const response = await fetch("/api/mkt/whatsapp/start", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ sessionName: WAHA_SESSION_NAME }),
      });
      await readApiJson(response);
      await fetchWahaStatus();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setConnectionLoading(null);
    }
  };

  const fetchQrCode = async () => {
    setConnectionLoading("qr");
    setActionError(null);
    try {
      const response = await fetch("/api/mkt/whatsapp/qr", { headers: AUTH_HEADERS });
      const data = await readApiJson<{ qr?: string | null; status?: string | null; message?: string | null }>(response);
      setWahaRawStatus(data.status ?? null);
      setQrCode(data.qr ?? null);
      setQrMessage(data.message ?? null);
      setWahaStatus(statusToUiStatus(data.status));
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setConnectionLoading(null);
    }
  };

  const fetchWahaDebug = async () => {
    setConnectionLoading("debug");
    setActionError(null);
    try {
      const response = await fetch("/api/mkt/whatsapp/debug", { headers: AUTH_HEADERS });
      const data = await readApiJson<WahaDebugState>(response);
      setWahaDebug(data);
      setWahaRawStatus(data.status);
      setWahaStatus(data.canReachWaha ? statusToUiStatus(data.status) : "error");
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setConnectionLoading(null);
    }
  };

  const logoutSession = async () => {
    setConnectionLoading("logout");
    setActionError(null);
    try {
      const response = await fetch("/api/mkt/whatsapp/logout", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ sessionName: WAHA_SESSION_NAME }),
      });
      await readApiJson(response);
      setQrCode(null);
      await fetchWahaStatus();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setConnectionLoading(null);
    }
  };

  const handleImageChange = (file?: File) => {
    setActionError(null);
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setActionError("La imagen debe ser JPG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setActionError("La imagen no puede pesar más de 5 MB.");
      return;
    }
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const insertVariable = (variable: "{{nombre}}" | "{{alumno}}") => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? message.length;
    const end = textarea?.selectionEnd ?? message.length;
    const nextMessage = `${message.slice(0, start)}${variable}${message.slice(end)}`;
    setMessage(nextMessage);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + variable.length, start + variable.length);
    });
  };

  const handleCreateCampaign = async () => {
    const cleanName = name.trim();
    const cleanMessage = message.trim();
    const messageLimit = imageFile ? 1024 : 4096;
    if (!cleanName) return setActionError("Ponle un nombre a la campaña.");
    if (!cleanMessage) return setActionError("Escribe el mensaje que quieres enviar.");
    if (cleanMessage.length > messageLimit) {
      return setActionError(`El mensaje supera el límite de ${messageLimit} caracteres.`);
    }

    setCreatingCampaign(true);
    setActionError(null);
    setNotice(null);
    try {
      let imageStorageId: Id<"_storage"> | undefined;
      if (imageFile) {
        const uploadUrl = await generateUploadUrl();
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageFile.type },
          body: imageFile,
        });
        const uploadData = await readApiJson<{ storageId: Id<"_storage"> }>(uploadResponse);
        imageStorageId = uploadData.storageId;
      }

      const response = await fetch("/api/mkt/campaigns", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          name: cleanName,
          segment,
          messageTemplate: cleanMessage,
          imageStorageId,
          imageMimeType: imageFile?.type,
          imageFileName: imageFile?.name,
        }),
      });
      const data = await readApiJson<{
        campaignId: Id<"marketingCampaigns">;
        preparedCount: number;
      }>(response);
      setSelectedCampaignId(data.campaignId);
      setView("history");
      setNotice(
        data.preparedCount > 0
          ? `Campaña preparada para ${data.preparedCount} contactos.`
          : "La campaña se guardó, pero no encontramos teléfonos válidos en ese segmento."
      );
      setName("");
      setMessage("Hola {{nombre}} 💙\n\n");
      removeImage();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setCreatingCampaign(false);
    }
  };

  const handleSendTest = async () => {
    if (!selectedCampaignId || !testPhone.trim()) {
      setActionError("Ingresa un teléfono para enviar la prueba.");
      return;
    }
    if (wahaStatus !== "connected") {
      setActionError("Conecta WhatsApp antes de enviar una prueba.");
      return;
    }
    setSendingTest(true);
    setActionError(null);
    try {
      const response = await fetch("/api/mkt/send-test", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          phone: testPhone,
          sessionName: WAHA_SESSION_NAME,
        }),
      });
      await readApiJson(response);
      setNotice("Prueba enviada con el primer mensaje personalizado de la campaña.");
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSendingTest(false);
    }
  };

  const handleBatch = async (target: number) => {
    if (!selectedCampaignId || !selectedCampaign) return;
    if (wahaStatus !== "connected") {
      setActionError("Conecta WhatsApp antes de iniciar la tanda.");
      return;
    }
    stopBatchRef.current = false;
    setSendingBatch(true);
    setActionError(null);
    setNotice(null);
    let sent = 0;
    let failed = 0;
    let remaining = totals.pending;
    setBatchProgress({ target, completed: 0, sent, failed, remaining, waitingSeconds: 0 });

    try {
      for (let index = 0; index < target && remaining > 0; index++) {
        if (stopBatchRef.current) break;
        const response = await fetch("/api/mkt/send-batch", {
          method: "POST",
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            campaignId: selectedCampaignId,
            limit: 1,
            sessionName: WAHA_SESSION_NAME,
          }),
        });
        const data = await readApiJson<{
          summary: { attempted: number; sent: number; failed: number; remaining: number };
        }>(response);
        if (data.summary.attempted === 0) break;
        sent += data.summary.sent;
        failed += data.summary.failed;
        remaining = data.summary.remaining;
        const completed = index + 1;
        setBatchProgress({ target, completed, sent, failed, remaining, waitingSeconds: 0 });

        if (completed < target && remaining > 0 && !stopBatchRef.current) {
          const delaySeconds = isDryRun ? 0 : Math.floor(Math.random() * 36) + 25;
          for (let second = delaySeconds; second > 0; second--) {
            if (stopBatchRef.current) break;
            setBatchProgress({ target, completed, sent, failed, remaining, waitingSeconds: second });
            await sleep(1000);
          }
        }
      }
      setNotice(stopBatchRef.current ? "La tanda se detuvo de forma segura." : `Tanda terminada: ${sent} enviados, ${failed} errores.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSendingBatch(false);
      setBatchProgress((current) => current ? { ...current, waitingSeconds: 0 } : null);
    }
  };

  const handlePauseResumeCampaign = async (paused: boolean) => {
    if (!selectedCampaignId) return;
    stopBatchRef.current = true;
    setPausingCampaign(true);
    setActionError(null);
    try {
      const response = await fetch("/api/mkt/campaigns/pause", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ campaignId: selectedCampaignId, paused }),
      });
      await readApiJson(response);
      setNotice(paused ? "Campaña pausada." : "Campaña lista para continuar.");
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setPausingCampaign(false);
    }
  };

  const openCampaign = (campaignId: Id<"marketingCampaigns">) => {
    stopBatchRef.current = true;
    setSelectedCampaignId(campaignId);
    setView("history");
    setActionError(null);
    setNotice(null);
  };

  const messageLimit = imageFile ? 1024 : 4096;
  const previewMessage = renderPreview(message);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <button className={styles.backButton} onClick={() => window.history.back()} aria-label="Volver">
          <ArrowLeft size={19} />
        </button>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Mística comunica</span>
          <h1>Campañas<br /><em>con intención.</em></h1>
        </div>
        <div className={styles.heroBubble} aria-hidden="true"><MessageCircle size={25} /></div>
      </header>

      <main className={styles.content}>
        <details className={styles.connectionCard}>
          <summary>
            <span className={`${styles.connectionIcon} ${styles[wahaStatus]}`}>
              {wahaStatus === "connected" ? <Wifi size={18} /> : <WifiOff size={18} />}
            </span>
            <span className={styles.connectionCopy}>
              <strong>{wahaStatus === "connected" ? "WhatsApp conectado" : "Conexión de WhatsApp"}</strong>
              <small>{isDryRun ? "Modo simulación activo" : wahaRawStatus || "Toca para revisar"}</small>
            </span>
            <span className={`${styles.connectionStatus} ${styles[wahaStatus]}`}>
              {wahaStatus === "connected" ? "Listo" : wahaStatus === "loading" ? "Revisando" : "Atención"}
            </span>
            <ChevronDown className={styles.chevron} size={18} />
          </summary>
          <div className={styles.connectionBody}>
            <p>Vincula la línea que enviará las campañas. No cierres esa sesión durante una tanda.</p>
            <div className={styles.connectionActions}>
              <button onClick={fetchWahaStatus} disabled={Boolean(connectionLoading)}><RefreshCw size={15} /> Revisar</button>
              <button onClick={startSession} disabled={Boolean(connectionLoading)}><Play size={15} /> Iniciar</button>
              <button onClick={fetchQrCode} disabled={Boolean(connectionLoading)}><Smartphone size={15} /> Ver QR</button>
              <button onClick={fetchWahaDebug} disabled={Boolean(connectionLoading)}>Diagnóstico</button>
              <button className={styles.dangerText} onClick={logoutSession} disabled={Boolean(connectionLoading)}>Cerrar sesión</button>
            </div>
            {connectionLoading && <div className={styles.inlineLoading}><LoaderCircle size={15} /> Procesando…</div>}
            {qrCode && (
              <div className={styles.qrPanel}>
                <img src={qrCode} alt="Código QR para vincular WhatsApp" />
                <span>WhatsApp › Dispositivos vinculados › Vincular dispositivo</span>
              </div>
            )}
            {qrMessage && <p className={styles.connectionNote}>{qrMessage}</p>}
            {wahaDebug && (
              <div className={styles.debugGrid}>
                <span><small>Servidor</small><strong>{wahaDebug.canReachWaha ? "Disponible" : "Sin respuesta"}</strong></span>
                <span><small>Sesión</small><strong>{wahaDebug.sessionName}</strong></span>
              </div>
            )}
          </div>
        </details>

        <nav className={styles.viewTabs} aria-label="Secciones de campañas">
          <button className={view === "compose" ? styles.activeTab : ""} onClick={() => { setView("compose"); setSelectedCampaignId(null); }}>
            <ImagePlus size={17} /> Nueva campaña
          </button>
          <button className={view === "history" ? styles.activeTab : ""} onClick={() => { setView("history"); setSelectedCampaignId(null); }}>
            <History size={17} /> Historial
            {campaigns && campaigns.length > 0 && <span>{campaigns.length}</span>}
          </button>
        </nav>

        {actionError && (
          <div className={styles.alertError} role="alert">
            <AlertTriangle size={18} /><span>{actionError}</span><button onClick={() => setActionError(null)} aria-label="Cerrar"><X size={16} /></button>
          </div>
        )}
        {notice && (
          <div className={styles.alertSuccess} role="status">
            <Check size={18} /><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Cerrar"><X size={16} /></button>
          </div>
        )}

        {view === "compose" ? (
          <>
            <details className={styles.guideCard} open>
              <summary>
                <span className={styles.guideIcon}><MessageCircle size={19} /></span>
                <span className={styles.guideTitle}>
                  <strong>Cómo enviar una campaña</strong>
                  <small>6 pasos fáciles · nada se envía sin tu confirmación</small>
                </span>
                <ChevronDown className={styles.chevron} size={18} />
              </summary>
              <ol className={styles.guideSteps}>
                <li>
                  <span>1</span>
                  <div><strong>Conecta WhatsApp</strong><p>Abre “Conexión de WhatsApp” arriba y confirma que diga <em>Listo</em>.</p></div>
                </li>
                <li>
                  <span>2</span>
                  <div><strong>Elige a quién escribirle</strong><p>Ponle un nombre a la campaña y selecciona Natación, Aquagym o toda la comunidad.</p></div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>Escribe y personaliza el mensaje</strong>
                    <p>Usa las variables para que cada persona reciba su mensaje con los nombres correctos.</p>
                    <div className={styles.variableGuide}>
                      <span><code>{"{{nombre}}"}</code><small>Quien recibe el mensaje. En Natación suele ser el representante.</small></span>
                      <span><code>{"{{alumno}}"}</code><small>El alumno o los alumnos relacionados con ese teléfono.</small></span>
                    </div>
                    <p className={styles.guideExample}><b>Ejemplo:</b> “Hola {"{{nombre}}"}, invitamos a {"{{alumno}}"}” se convierte en “Hola Marta, invitamos a Ana y Luis”. En Aquagym, ambos nombres normalmente son iguales.</p>
                  </div>
                </li>
                <li>
                  <span>4</span>
                  <div><strong>Revisa cómo llegará</strong><p>Mira la vista previa y, si quieres, adjunta una imagen de hasta 5 MB.</p></div>
                </li>
                <li>
                  <span>5</span>
                  <div><strong>Prepara y prueba</strong><p>Toca “Preparar campaña” y envía primero una prueba a tu propio teléfono.</p></div>
                </li>
                <li>
                  <span>6</span>
                  <div><strong>Envía por tandas</strong><p>Cuando la prueba esté bien, envía 10 o 25 mensajes y sigue el progreso.</p></div>
                </li>
              </ol>
            </details>

            <div className={styles.composeStack}>
            <section className={styles.formCard}>
              <div className={styles.sectionHeading}>
                <span>01</span>
                <div><h2>La idea</h2><p>Dale un nombre y elige a quién quieres hablarle.</p></div>
              </div>
              <label className={styles.field}>
                <span>Nombre de la campaña</span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ej. Vacaciones de invierno" />
                <small>{name.length}/80</small>
              </label>
              <fieldset className={styles.segmentField}>
                <legend>Destinatarios</legend>
                <div>
                  {(["natacion", "aquagym", "all"] as Segment[]).map((option) => (
                    <button key={option} type="button" className={segment === option ? styles.segmentActive : ""} onClick={() => setSegment(option)}>
                      {segmentLabel(option)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </section>

            <section className={styles.formCard}>
              <div className={styles.sectionHeading}>
                <span>02</span>
                <div><h2>El mensaje</h2><p>Personalízalo sin perder tu voz.</p></div>
              </div>
              <div className={styles.variableRow}>
                <span>Insertar variable</span>
                <button type="button" onClick={() => insertVariable("{{nombre}}")}>+ Nombre</button>
                <button type="button" onClick={() => insertVariable("{{alumno}}")}>+ Alumno</button>
              </div>
              <p className={styles.variableHint}><b>Nombre</b> saluda a quien recibe · <b>Alumno</b> menciona a quien toma clases.</p>
              <label className={styles.textareaField}>
                <span className={styles.srOnly}>Mensaje de campaña</span>
                <textarea ref={textareaRef} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe aquí tu mensaje…" rows={8} />
                <small className={message.length > messageLimit ? styles.counterError : ""}>{message.length}/{messageLimit}</small>
              </label>

              <div className={styles.imageField}>
                {imagePreview ? (
                  <div className={styles.imageSelected}>
                    <img src={imagePreview} alt="Vista previa de la imagen seleccionada" />
                    <div><strong>{imageFile?.name}</strong><small>{imageFile ? `${(imageFile.size / 1024 / 1024).toFixed(1)} MB` : ""}</small></div>
                    <button type="button" onClick={removeImage} aria-label="Quitar imagen"><Trash2 size={17} /></button>
                  </div>
                ) : (
                  <label className={styles.imageDrop}>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleImageChange(event.target.files?.[0])} />
                    <span><ImagePlus size={21} /></span>
                    <div><strong>Adjuntar una imagen</strong><small>JPG, PNG o WebP · máximo 5 MB</small></div>
                  </label>
                )}
              </div>
            </section>

            <section className={styles.previewCard}>
              <div className={styles.previewTop}><span>03</span><strong>Así llegará</strong><small>Vista previa</small></div>
              <div className={styles.phonePreview}>
                <div className={styles.phoneTop}><ArrowLeft size={15} /><span className={styles.miniAvatar}>M</span><strong>Mística Natación</strong></div>
                <div className={styles.chatTexture}>
                  <div className={styles.messageBubble}>
                    {imagePreview && <img src={imagePreview} alt="" />}
                    <p>{previewMessage || "Tu mensaje aparecerá aquí."}</p>
                    <time>10:42 <Check size={12} /></time>
                  </div>
                </div>
              </div>
              <button className={styles.primaryAction} onClick={handleCreateCampaign} disabled={creatingCampaign || message.length > messageLimit}>
                {creatingCampaign ? <><LoaderCircle className={styles.spin} size={18} /> Preparando campaña…</> : <><Send size={18} /> Preparar campaña</>}
              </button>
              <p className={styles.actionHint}>Nada se envía todavía. Primero podrás hacer una prueba.</p>
            </section>
            </div>
          </>
        ) : selectedCampaign ? (
          <section className={styles.detailView}>
            <button className={styles.inlineBack} onClick={() => setSelectedCampaignId(null)}><ArrowLeft size={16} /> Volver al historial</button>
            <div className={styles.detailHero}>
              <div>
                <span className={styles.detailDate}>{formatDate(selectedCampaign.createdAt)}</span>
                <h2>{selectedCampaign.name}</h2>
                <p>{segmentLabel(selectedCampaign.segment)}</p>
              </div>
              <span className={`${styles.statusPill} ${styles[`status_${selectedCampaign.status}`]}`}>{statusLabel(selectedCampaign.status)}</span>
            </div>

            <div className={styles.statsGrid}>
              <div><strong>{totals.total}</strong><span>Contactos</span></div>
              <div><strong>{totals.sent}</strong><span>Enviados</span></div>
              <div><strong>{totals.pending}</strong><span>Pendientes</span></div>
              <div className={totals.error > 0 ? styles.statError : ""}><strong>{totals.error}</strong><span>Errores</span></div>
            </div>

            <div className={styles.savedMessage}>
              {selectedCampaign.imageUrl && <img src={selectedCampaign.imageUrl} alt={`Imagen de ${selectedCampaign.name}`} />}
              <div><small>Mensaje guardado</small><p>{selectedCampaign.messageTemplate || messages?.[0]?.message || "Sin vista previa disponible."}</p></div>
            </div>

            {totals.total === 0 && messages && (
              <div className={styles.emptyRecipients}><Users size={27} /><strong>No hay destinatarios válidos</strong><p>Revisa que los alumnos activos de este segmento tengan un celular registrado.</p></div>
            )}

            {totals.total > 0 && (
              <>
                <div className={styles.testPanel}>
                  <div><span><Smartphone size={17} /></span><div><strong>Primero, haz una prueba</strong><small>Usaremos el primer mensaje personalizado.</small></div></div>
                  <div className={styles.testControls}>
                    <input type="tel" value={testPhone} onChange={(event) => setTestPhone(event.target.value)} placeholder="591 7…" aria-label="Teléfono de prueba" />
                    <button onClick={handleSendTest} disabled={sendingTest || sendingBatch || wahaStatus !== "connected"}>
                      {sendingTest ? <LoaderCircle className={styles.spin} size={16} /> : <Send size={16} />} Probar
                    </button>
                  </div>
                </div>

                <div className={styles.dispatchPanel}>
                  <div className={styles.dispatchHeading}>
                    <div><span className={styles.whatsappMark}><MessageCircle size={19} /></span><div><strong>Despachar campaña</strong><small>Pausas humanas de 25–60 segundos.</small></div></div>
                    {(selectedCampaign.status === "ready" || selectedCampaign.status === "sending") && (
                      <button className={styles.pauseButton} onClick={() => handlePauseResumeCampaign(true)} disabled={pausingCampaign}><Pause size={15} /> Pausar</button>
                    )}
                    {selectedCampaign.status === "paused" && (
                      <button className={styles.pauseButton} onClick={() => handlePauseResumeCampaign(false)} disabled={pausingCampaign}><Play size={15} /> Reanudar</button>
                    )}
                  </div>

                  {batchProgress && (
                    <div className={styles.progressPanel}>
                      <div><strong>{batchProgress.completed} de {batchProgress.target}</strong><span>{batchProgress.waitingSeconds > 0 ? `Siguiente envío en ${batchProgress.waitingSeconds}s` : "Procesando tanda"}</span></div>
                      <div className={styles.progressTrack}><span style={{ width: `${Math.min(100, (batchProgress.completed / batchProgress.target) * 100)}%` }} /></div>
                      <small>{batchProgress.sent} enviados · {batchProgress.failed} errores · {batchProgress.remaining} pendientes</small>
                    </div>
                  )}

                  {sendingBatch ? (
                    <button className={styles.stopAction} onClick={() => { stopBatchRef.current = true; }}><X size={17} /> Detener después de este envío</button>
                  ) : (
                    <div className={styles.batchActions}>
                      <button onClick={() => handleBatch(10)} disabled={totals.pending === 0 || selectedCampaign.status === "paused" || sendingTest}><Send size={17} /> Enviar 10</button>
                      <button onClick={() => handleBatch(25)} disabled={totals.pending === 0 || selectedCampaign.status === "paused" || sendingTest}><Send size={17} /> Enviar 25</button>
                    </div>
                  )}
                </div>
              </>
            )}

            <div className={styles.recipientSection}>
              <div className={styles.recipientHeading}><h3>Destinatarios</h3><span>{totals.total}</span></div>
              <div className={styles.recipientList}>
                {!messages && <div className={styles.loadingRows}><LoaderCircle className={styles.spin} size={20} /> Cargando destinatarios…</div>}
                {messages?.map((item) => (
                  <div className={styles.recipientRow} key={item._id}>
                    <span className={styles.recipientAvatar}>{(item.recipientName || "?").slice(0, 1).toUpperCase()}</span>
                    <div><strong>{item.recipientName || "Sin nombre"}</strong><small>{maskPhone(item.normalizedPhone)}{item.studentName ? ` · ${item.studentName}` : ""}</small>{item.error && <em>{item.error}</em>}</div>
                    <span className={`${styles.messageStatus} ${styles[`message_${item.status}`]}`}>{item.status === "sent" ? "Enviado" : item.status === "pending" ? "En cola" : item.status === "sending" ? "Enviando" : item.status === "error" ? "Error" : "Omitido"}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <section className={styles.historyView}>
            <div className={styles.historyIntro}><span>Archivo de campañas</span><h2>Lo enviado también<br />cuenta una historia.</h2><p>Revisa el mensaje, la imagen y el resultado de cada campaña.</p></div>
            {!campaigns && <div className={styles.loadingRows}><LoaderCircle className={styles.spin} size={20} /> Cargando historial…</div>}
            {campaigns?.length === 0 && (
              <div className={styles.emptyHistory}><History size={31} /><h3>Aún no hay campañas</h3><p>La primera aparecerá aquí cuando la prepares.</p><button onClick={() => setView("compose")}>Crear una campaña</button></div>
            )}
            <div className={styles.campaignList}>
              {campaigns?.map((campaign) => (
                <button className={styles.campaignRow} key={campaign._id} onClick={() => openCampaign(campaign._id)}>
                  <span className={styles.campaignThumb}>
                    {campaign.imageUrl ? <img src={campaign.imageUrl} alt="" /> : <MessageCircle size={21} />}
                  </span>
                  <span className={styles.campaignMain}>
                    <span className={styles.campaignMeta}>{formatDate(campaign.createdAt)} · {segmentLabel(campaign.segment)}</span>
                    <strong>{campaign.name}</strong>
                    <small>{campaign.counts?.sent ?? 0} enviados · {campaign.counts?.pending ?? 0} pendientes · {campaign.counts?.error ?? 0} errores</small>
                  </span>
                  <span className={`${styles.statusDot} ${styles[`status_${campaign.status}`]}`} title={statusLabel(campaign.status)} />
                  <ChevronDown className={styles.rowArrow} size={17} />
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
