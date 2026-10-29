import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Activity, ShieldCheck, Radio } from "lucide-react";
import type { AlertListItem } from "@/types";

interface OpsActivityVisualizerProps {
  alerts?: AlertListItem[];
  totalEvents?: number;
  latestLogFilename?: string;
  latestSha256?: string;
  isIdle?: boolean;
}

export default function OpsActivityVisualizer({
  alerts = [],
  totalEvents = 0,
  latestLogFilename,
  latestSha256,
  isIdle = false,
}: OpsActivityVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Live UTC Forensics Clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Canvas Oscilloscope & Precision Telemetry Stream
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let sweepX = 0;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Fixed internal resolution
    const width = 800;
    const height = 130;
    canvas.width = width;
    canvas.height = height;

    // Generate deterministic baseline points from alert timestamps / frequencies
    const dataPoints: { x: number; y: number; severity: string }[] = [];
    const alertCount = alerts.length;

    if (!isIdle && alertCount > 0) {
      alerts.forEach((alert, i) => {
        const xPos = 40 + ((i + 1) / (alertCount + 1)) * (width - 80);
        let yPos = height / 2;
        if (alert.severity === "critical") yPos = height * 0.22;
        else if (alert.severity === "high") yPos = height * 0.35;
        else if (alert.severity === "medium") yPos = height * 0.55;
        else yPos = height * 0.72;

        dataPoints.push({
          x: xPos,
          y: yPos,
          severity: alert.severity,
        });
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Background Grid & Graticule (Peach Precision Palette)
      ctx.fillStyle = "#111114";
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(53, 53, 62, 0.4)";
      const gridGap = 32;
      for (let x = 0; x < width; x += gridGap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridGap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center baseline in subtle peach tint
      ctx.strokeStyle = "rgba(255, 182, 158, 0.2)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // 2. Oscilloscope Wave Stream
      if (!isIdle && totalEvents > 0) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 182, 158, 0.85)";
        ctx.lineWidth = 1.5;

        for (let x = 0; x < width; x++) {
          const freq1 = 0.025;
          const freq2 = 0.08;
          const baseWave =
            Math.sin(x * freq1 + sweepX * 0.035) * 10 +
            Math.cos(x * freq2 - sweepX * 0.02) * 5;

          // Influence by nearby alert points
          let peakOffset = 0;
          for (const pt of dataPoints) {
            const dist = Math.abs(x - pt.x);
            if (dist < 40) {
              const factor = (40 - dist) / 40;
              peakOffset += (pt.y - height / 2) * factor * 0.8;
            }
          }

          const y = height / 2 + baseWave + peakOffset;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 3. Render Threat Alert Pulsar Markers
        for (const pt of dataPoints) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
          if (pt.severity === "critical") ctx.fillStyle = "#FF6B72";
          else if (pt.severity === "high") ctx.fillStyle = "#F2B85B";
          else if (pt.severity === "medium") ctx.fillStyle = "#F2B85B";
          else ctx.fillStyle = "#89858A";
          ctx.fill();

          // Restrained ring
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
          ctx.strokeStyle =
            pt.severity === "critical"
              ? "rgba(255, 107, 114, 0.4)"
              : "rgba(255, 182, 158, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        // Idle Standby Wave
        ctx.beginPath();
        ctx.strokeStyle = "rgba(137, 133, 138, 0.35)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x++) {
          const y = height / 2 + Math.sin(x * 0.015 + sweepX * 0.015) * 2.5;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // 4. Precision Sweep Line & Soft Glow
      if (!prefersReducedMotion) {
        ctx.strokeStyle = "rgba(255, 182, 158, 0.65)";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(sweepX, 0);
        ctx.lineTo(sweepX, height);
        ctx.stroke();

        // Decay gradient behind sweep line
        const grad = ctx.createLinearGradient(sweepX - 50, 0, sweepX, 0);
        grad.addColorStop(0, "rgba(255, 182, 158, 0)");
        grad.addColorStop(1, "rgba(255, 182, 158, 0.08)");
        ctx.fillStyle = grad;
        ctx.fillRect(sweepX - 50, 0, 50, height);

        sweepX = (sweepX + 2) % width;
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [alerts, totalEvents, isIdle]);

  return (
    <div className="nr-card overflow-hidden select-none font-sans">
      {/* HUD Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-surface-750/70 border-b border-surface-700 text-2xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-peach-primary font-semibold tracking-wide">
            <Radio className="w-3.5 h-3.5 text-peach-primary" />
            <span>Operations Telemetry Stream</span>
          </div>
          <span className="text-surface-600 hidden sm:inline">|</span>
          <span className="text-brand-secondary hidden sm:inline font-sans">
            Status:{" "}
            {isIdle ? (
              <span className="text-status-warning font-semibold">Standby (Idle)</span>
            ) : (
              <span className="text-status-success font-semibold">Active Ingestion</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-3 text-brand-muted text-3xs sm:text-2xs font-mono">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-status-success" />
            <span className="text-brand-secondary">Air-Gapped Offline</span>
          </div>
          <span className="text-brand-text">{currentTime}</span>
        </div>
      </div>

      {/* Canvas Radar Visualizer */}
      <div className="relative w-full h-32 sm:h-36 bg-surface-900 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ width: "100%", height: "100%" }}
        />

        {/* Center overlay label when idle */}
        {isIdle && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-surface-950/50">
            <div className="px-4 py-2 rounded-lg bg-surface-850/95 border border-surface-700 text-center space-y-1 shadow-card">
              <span className="text-xs font-semibold text-brand-text tracking-wide flex items-center justify-center gap-2">
                <Activity className="w-3.5 h-3.5 text-peach-primary" />
                Standby Telemetry: Awaiting Evidence Ingestion
              </span>
              <p className="text-2xs text-brand-muted font-sans">
                Upload or analyze a system log archive to stream live forensic telemetry
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Telemetry Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-surface-700 border-t border-surface-700 bg-surface-750/50 text-2xs font-sans">
        <div className="px-3.5 py-2 flex items-center justify-between">
          <span className="text-brand-muted text-3xs uppercase font-semibold">Events Ingested:</span>
          <span className="font-semibold text-brand-text font-mono tabular-nums">
            {totalEvents.toLocaleString()}
          </span>
        </div>
        <div className="px-3.5 py-2 flex items-center justify-between">
          <span className="text-brand-muted text-3xs uppercase font-semibold">Active Alerts:</span>
          <span
            className={clsx(
              "font-semibold font-mono tabular-nums",
              alerts.length > 0 ? "text-status-warning" : "text-brand-muted"
            )}
          >
            {alerts.length}
          </span>
        </div>
        <div className="px-3.5 py-2 flex items-center justify-between">
          <span className="text-brand-muted text-3xs uppercase font-semibold">Engine State:</span>
          <span className="text-status-success font-medium font-mono text-3xs">Rules + ML Active</span>
        </div>
        <div className="px-3.5 py-2 flex items-center justify-between truncate">
          <span className="text-brand-muted text-3xs uppercase font-semibold">Target Archive:</span>
          <span
            className="text-peach-primary font-medium font-mono text-3xs truncate max-w-[140px]"
            title={latestLogFilename ? `${latestLogFilename} (SHA-256: ${latestSha256 || 'N/A'})` : "Awaiting evidence ingestion"}
          >
            {latestLogFilename ? `${latestLogFilename} [${latestSha256 ? latestSha256.substring(0, 6) : "OK"}]` : "Standby"}
          </span>
        </div>
      </div>
    </div>
  );
}
