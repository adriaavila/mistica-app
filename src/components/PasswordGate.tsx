"use client";
import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "mistica_auth_v1";
const PASSWORD = "Mistica-Admin246";

const MESSAGES = [
  { icon: "🏊", text: "Gestiona tus alumnos de natación" },
  { icon: "📋", text: "Controla la asistencia fácilmente" },
  { icon: "💳", text: "Registra y sigue los cobros" },
  { icon: "📊", text: "Ve el rendimiento del club" },
  { icon: "⚡", text: "Datos en tiempo real" },
  { icon: "🎽", text: "Todo tu club en un solo lugar" },
];

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [msgVisible, setMsgVisible] = useState(true);

  useEffect(() => {
    setUnlocked(localStorage.getItem(STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    if (unlocked) return;
    const interval = setInterval(() => {
      setMsgVisible(false);
      setTimeout(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length);
        setMsgVisible(true);
      }, 400);
    }, 2800);
    return () => clearInterval(interval);
  }, [unlocked]);

  const submit = useCallback(() => {
    if (input === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
    } else {
      setError(true);
      setInput("");
      setTimeout(() => setError(false), 800);
    }
  }, [input]);

  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;

  const msg = MESSAGES[msgIndex];

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(160deg, #0EA5E9 0%, #0284C7 40%, #075985 100%)",
      padding: "32px 24px",
      fontFamily: "var(--font)",
    }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{
          width: 72, height: 72,
          background: "rgba(255,255,255,0.15)",
          borderRadius: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
          backdropFilter: "blur(8px)",
          border: "1.5px solid rgba(255,255,255,0.25)",
          fontSize: 36,
        }}>🏊‍♂️</div>
        <h1 style={{
          color: "#fff",
          fontSize: 32,
          fontWeight: 800,
          margin: 0,
          letterSpacing: "-0.5px",
        }}>Mística</h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, margin: "4px 0 0", fontWeight: 500 }}>
          Gestión de clases de natación
        </p>
      </div>

      {/* Animated feature message */}
      <div style={{
        height: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 40,
      }}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: msgVisible ? 1 : 0,
          transform: msgVisible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.4s ease, transform 0.4s ease",
        }}>
          <span style={{ fontSize: 32 }}>{msg.icon}</span>
          <span style={{
            color: "rgba(255,255,255,0.95)",
            fontSize: 16,
            fontWeight: 600,
            textAlign: "center",
          }}>{msg.text}</span>
        </div>
      </div>

      {/* Password card */}
      <div style={{
        width: "100%",
        maxWidth: 360,
        background: "rgba(255,255,255,0.12)",
        borderRadius: 20,
        padding: "28px 24px",
        backdropFilter: "blur(16px)",
        border: "1.5px solid rgba(255,255,255,0.2)",
        animation: error ? "shake 0.5s ease" : "none",
      }}>
        <p style={{
          color: "rgba(255,255,255,0.9)",
          fontSize: 15,
          fontWeight: 600,
          margin: "0 0 16px",
          textAlign: "center",
        }}>Introduce la contraseña de acceso</p>

        <div style={{ position: "relative" }}>
          <input
            type={showPwd ? "text" : "password"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Contraseña"
            autoComplete="current-password"
            style={{
              width: "100%",
              padding: "14px 48px 14px 16px",
              borderRadius: 12,
              border: error
                ? "1.5px solid #FCA5A5"
                : "1.5px solid rgba(255,255,255,0.25)",
              background: error
                ? "rgba(220,38,38,0.15)"
                : "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 16,
              fontFamily: "var(--font)",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s, background 0.2s",
            }}
          />
          <button
            onClick={() => setShowPwd((v) => !v)}
            style={{
              position: "absolute",
              right: 14,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.7)",
              fontSize: 18,
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
            }}
            tabIndex={-1}
            aria-label={showPwd ? "Ocultar" : "Mostrar"}
          >{showPwd ? "🙈" : "👁"}</button>
        </div>

        {error && (
          <p style={{
            color: "#FCA5A5",
            fontSize: 13,
            margin: "8px 0 0",
            textAlign: "center",
            fontWeight: 500,
          }}>Contraseña incorrecta</p>
        )}

        <button
          onClick={submit}
          style={{
            width: "100%",
            marginTop: 16,
            padding: "14px",
            borderRadius: 12,
            border: "none",
            background: "#fff",
            color: "#0284C7",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font)",
            transition: "opacity 0.15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseUp={(e) => (e.currentTarget.style.opacity = "1")}
        >
          Entrar
        </button>
      </div>

      {/* Dots indicator */}
      <div style={{ display: "flex", gap: 6, marginTop: 32 }}>
        {MESSAGES.map((_, i) => (
          <div key={i} style={{
            width: i === msgIndex ? 18 : 6,
            height: 6,
            borderRadius: 99,
            background: i === msgIndex ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)",
            transition: "width 0.3s ease, background 0.3s ease",
          }} />
        ))}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        input::placeholder { color: rgba(255,255,255,0.5); }
      `}</style>
    </div>
  );
}
