import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const dynamicParams = false;
export function generateStaticParams() { return ["180", "192", "512"].map(size => ({ size })); }

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: value } = await params;
  if (!["180", "192", "512"].includes(value)) return new Response("Not found", { status: 404 });
  const size = Number(value);
  const logo = await readFile(join(process.cwd(), "public/brand/logo-original.png"));
  // Render the original supplied wordmark in an icon frame; the source asset stays intact.
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#1c1b20", alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", position: "relative", width: size * .84, height: size * .84 / 1.8, overflow: "hidden" }}>
        <img alt="Spoiled Brats Café" src={`data:image/png;base64,${logo.toString("base64")}`} width={size * .84 * 1.122} height={size * .84 * 1.122} style={{ position: "absolute", left: -size * .84 * .062, top: -size * .84 / 1.92 * .552 }} />
      </div>
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
