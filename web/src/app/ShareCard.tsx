import { useEffect, useRef, useState } from "react";
import { type CardContent, drawCard, fontsReady } from "./card";

interface Props {
  content: CardContent;
  file: string;
}

export function ShareCard({ content, file }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("");

  // A 1080 by 1350 canvas is too much work for the first screen, so it is
  // drawn only once it is about to scroll into view.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = canvas.current;
    if (!el || near) return;
    if (typeof IntersectionObserver !== "function") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "400px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    let live = true;
    const draw = () => {
      if (live && canvas.current) drawCard(canvas.current, content);
    };
    draw();
    fontsReady().then(draw);
    return () => {
      live = false;
    };
  }, [content, near]);

  async function save() {
    const c = canvas.current;
    if (!c) return;
    await fontsReady();
    drawCard(c, content);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
    if (!blob) {
      setStatus("This browser could not make the image.");
      return;
    }
    const png = new File([blob], file, { type: "image/png" });
    if (navigator.canShare?.({ files: [png] })) {
      try {
        await navigator.share({ files: [png], title: "Band D" });
        setStatus("");
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Saved.");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      setStatus("Link copied. It opens on this area.");
    } catch {
      setStatus("Copy the page address to share this area.");
    }
  }

  return (
    <div className="share">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Your result as a picture: £${content.rate.toFixed(2)} per £1,000 in ${content.name}. ${content.standing}`}
      />
      <div>
        <p className="sub">
          Save your answer as a picture, the shape that fills a phone screen in a feed, or copy a link that opens on
          this area. The link holds the area, never your postcode.
        </p>
        <div className="actions">
          <button className="btn" type="button" onClick={save}>
            Save the picture
          </button>
          <button className="btn quiet" type="button" onClick={copy}>
            Copy the link
          </button>
        </div>
        <p className="status" role="status">
          {status}
        </p>
      </div>
    </div>
  );
}
