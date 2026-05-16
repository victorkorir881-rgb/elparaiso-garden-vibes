import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { siteUrl } from "@/lib/site-url";
import logoUrl from "@/assets/logo.png";

type Props = {
  /** Path on the public site the QR should point to. Defaults to /menu. */
  path?: string;
  /** Label shown above and below the QR code. */
  label?: string;
};

/**
 * Admin button + dialog that generates a branded, downloadable QR code
 * pointing customers to a given page (menu by default). Renders to an
 * offscreen canvas with: blue scanner-style corner frame, label top/bottom,
 * QR matrix, and the brand logo overlaid in the center.
 */
export function MenuQrButton({ path = "/menu", label = "FOOD MENU" }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(() => siteUrl(path));
  const [labelText, setLabelText] = useState(label);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Reset to current path whenever the dialog is opened so the URL stays in
  // sync with the deployed origin (useful in dev vs prod previews).
  useEffect(() => {
    if (open) {
      setUrl(siteUrl(path));
      setLabelText(label);
    }
  }, [open, path, label]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void render(url, labelText).then((d) => {
      if (!cancelled) setDataUrl(d);
    });
    return () => {
      cancelled = true;
    };
  }, [open, url, labelText]);

  const render = async (targetUrl: string, text: string): Promise<string> => {
    // 1024 px square — high enough for poster printing.
    const SIZE = 1024;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Render QR matrix to an offscreen canvas, then composite.
    const qrCanvas = document.createElement("canvas");
    const qrSize = Math.round(SIZE * 0.72);
    await QRCode.toCanvas(qrCanvas, targetUrl, {
      width: qrSize,
      margin: 1,
      errorCorrectionLevel: "H", // high so the center logo overlay still scans
      color: { dark: "#000000", light: "#ffffff" },
    });
    const qrX = (SIZE - qrSize) / 2;
    const qrY = (SIZE - qrSize) / 2;
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

    // Blue scanner-style corner frame
    const frameInset = Math.round(SIZE * 0.06);
    const frameSize = SIZE - frameInset * 2;
    const cornerLen = Math.round(SIZE * 0.18);
    const stroke = Math.round(SIZE * 0.022);
    ctx.strokeStyle = "#2f7dd1";
    ctx.lineWidth = stroke;
    ctx.lineCap = "round";
    const x0 = frameInset;
    const y0 = frameInset;
    const x1 = frameInset + frameSize;
    const y1 = frameInset + frameSize;
    const drawCorner = (cx: number, cy: number, dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx * cornerLen, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * cornerLen);
      ctx.stroke();
    };
    drawCorner(x0, y0, 1, 1);
    drawCorner(x1, y0, -1, 1);
    drawCorner(x0, y1, 1, -1);
    drawCorner(x1, y1, -1, -1);

    // Short tick marks at mid-edges (matches sample QR aesthetic)
    const tickLen = Math.round(SIZE * 0.05);
    const drawTick = (mx: number, my: number, dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(mx - (dy * tickLen) / 2, my - (dx * tickLen) / 2);
      ctx.lineTo(mx + (dy * tickLen) / 2, my + (dx * tickLen) / 2);
      ctx.stroke();
    };
    drawTick(SIZE / 2, y0, 1, 0);
    drawTick(SIZE / 2, y1, 1, 0);
    drawTick(x0, SIZE / 2, 0, 1);
    drawTick(x1, SIZE / 2, 0, 1);

    // Top + bottom label text
    if (text) {
      ctx.fillStyle = "#0d0d0d";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const fontSize = Math.round(SIZE * 0.07);
      ctx.font = `700 ${fontSize}px "Playfair Display", Georgia, serif`;
      ctx.fillText(text, SIZE / 2, frameInset / 2 + fontSize * 0.1);
      ctx.fillText(text, SIZE / 2, SIZE - frameInset / 2 + fontSize * 0.1);
    }

    // Center logo overlay (with white rounded backdrop for contrast & scan)
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const badge = Math.round(SIZE * 0.18);
        const bx = (SIZE - badge) / 2;
        const by = (SIZE - badge) / 2;
        const r = Math.round(badge * 0.22);
        // rounded white background
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.lineTo(bx + badge - r, by);
        ctx.quadraticCurveTo(bx + badge, by, bx + badge, by + r);
        ctx.lineTo(bx + badge, by + badge - r);
        ctx.quadraticCurveTo(bx + badge, by + badge, bx + badge - r, by + badge);
        ctx.lineTo(bx + r, by + badge);
        ctx.quadraticCurveTo(bx, by + badge, bx, by + badge - r);
        ctx.lineTo(bx, by + r);
        ctx.quadraticCurveTo(bx, by, bx + r, by);
        ctx.closePath();
        ctx.fill();
        const pad = Math.round(badge * 0.08);
        ctx.drawImage(img, bx + pad, by + pad, badge - pad * 2, badge - pad * 2);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = logoUrl;
    });

    return canvas.toDataURL("image/png");
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `elparaiso-${labelText.toLowerCase().replace(/\s+/g, "-") || "qr"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("QR code downloaded");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="border-border text-foreground hover:bg-accent"
        onClick={() => setOpen(true)}
      >
        <QrCode className="w-4 h-4 mr-1" /> Menu QR
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Menu QR Code</DialogTitle>
            <DialogDescription>
              Print or share. Customers scan to open the live menu.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="aspect-square w-full rounded-xl border border-border bg-white overflow-hidden flex items-center justify-center">
              {dataUrl ? (
                <img
                  src={dataUrl}
                  alt="Menu QR code preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-muted-foreground">Generating…</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-label" className="text-xs text-muted-foreground">
                Label
              </Label>
              <Input
                id="qr-label"
                value={labelText}
                onChange={(e) => setLabelText(e.target.value.slice(0, 24))}
                placeholder="FOOD MENU"
                className="bg-card border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="qr-url" className="text-xs text-muted-foreground">
                Destination URL
              </Label>
              <div className="flex gap-2">
                <Input
                  id="qr-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="bg-card border-border text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-border shrink-0"
                  onClick={copy}
                  aria-label="Copy link"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Hidden working canvas (kept in DOM for stable refs) */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="border-border"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
            <Button
              className="bg-primary text-primary-foreground"
              onClick={download}
              disabled={!dataUrl}
            >
              <Download className="w-4 h-4 mr-1" /> Download PNG
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default MenuQrButton;
