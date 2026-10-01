import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const port = Number(process.env.PORT || 4173);
const contentSecurityPolicy = "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'";
function setSecurityHeaders(response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  response.setHeader("Content-Security-Policy", contentSecurityPolicy);
}
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/colecao.html", ["colecao.html", "text/html; charset=utf-8"]],
  ["/bootstrap.js", ["bootstrap.js", "text/javascript; charset=utf-8"]],
  ["/play.js", ["play.js", "text/javascript; charset=utf-8"]],
  ["/backend-client.mjs", ["backend-client.mjs", "text/javascript; charset=utf-8"]],
  ["/account-policy.mjs", ["account-policy.mjs", "text/javascript; charset=utf-8"]],
  ["/account.css", ["account.css", "text/css; charset=utf-8"]],
  ["/account-pages.css", ["account-pages.css", "text/css; charset=utf-8"]],
  ["/account-art.mjs", ["account-art.mjs", "text/javascript; charset=utf-8"]],
  ["/account-views.mjs", ["account-views.mjs", "text/javascript; charset=utf-8"]],
  ["/lobby-view.mjs", ["lobby-view.mjs", "text/javascript; charset=utf-8"]],
  ["/ui-icons.mjs", ["ui-icons.mjs", "text/javascript; charset=utf-8"]],
  ["/taste.css", ["taste.css", "text/css; charset=utf-8"]],
  ["/legal.html", ["legal.html", "text/html; charset=utf-8"]],
  ["/admin-panel.mjs", ["admin-panel.mjs", "text/javascript; charset=utf-8"]],
  ["/admin.css", ["admin.css", "text/css; charset=utf-8"]],
  ["/practical.css", ["practical.css", "text/css; charset=utf-8"]],
  ["/lobby.css", ["lobby.css", "text/css; charset=utf-8"]],
  ["/wizard.css", ["wizard.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/model.mjs", ["model.mjs", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/arena.css", ["arena.css", "text/css; charset=utf-8"]],
  ["/shop.css", ["shop.css", "text/css; charset=utf-8"]],
  ["/profile.css", ["profile.css", "text/css; charset=utf-8"]],
  ["/achievements.css", ["achievements.css", "text/css; charset=utf-8"]],
  ["/clubs.mjs", ["clubs.mjs", "text/javascript; charset=utf-8"]],
  ["/football-trophies.mjs", ["football-trophies.mjs", "text/javascript; charset=utf-8"]],
  ["/rivalry-section.mjs", ["rivalry-section.mjs", "text/javascript; charset=utf-8"]],
  ["/rivalry.css", ["rivalry.css", "text/css; charset=utf-8"]],
  ["/competitive-modes.css", ["competitive-modes.css", "text/css; charset=utf-8"]],
  ["/assets/brand/ea-sports-fc.svg", ["assets/brand/ea-sports-fc.svg", "image/svg+xml"]],
]);

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url || "/", "http://localhost").pathname;
  } catch {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  const playerAsset = /^\/assets\/players\/[a-z0-9-]+\.jpg$/.test(pathname);
  const avatarAsset = /^\/assets\/avatars\/[a-z0-9-]+\.(png|jpg)$/.exec(pathname);
  const signatureAsset = /^\/assets\/signatures\/[a-z0-9-]+\.svg$/.test(pathname);
  const clubAsset = /^\/assets\/clubs\/[a-z0-9-]+\.(svg|png|webp)$/.exec(pathname);
  const trophyAsset = /^\/assets\/trophies\/[a-z0-9-]+\.svg$/.test(pathname);
  const flagAsset = /^\/assets\/flags\/[a-z0-9-]+\.svg$/.test(pathname);
  const kitAsset = /^\/assets\/kits\/[a-z0-9-]+\.(png|jpg|webp)$/.exec(pathname);
  const brandAsset = /^\/assets\/brand\/[a-z0-9-]+\.(png|webp|svg)$/.exec(pathname);
  const clubMime = clubAsset ? ({svg:"image/svg+xml",png:"image/png",webp:"image/webp"}[clubAsset[1]]) : null;
  const mime = playerAsset ? "image/jpeg" : avatarAsset ? (avatarAsset[1]==='jpg' ? 'image/jpeg' : 'image/png') : kitAsset ? ({png:'image/png',jpg:'image/jpeg',webp:'image/webp'}[kitAsset[1]]) : signatureAsset||trophyAsset||flagAsset ? "image/svg+xml" : clubMime;
  const brandMime = brandAsset ? ({png:'image/png',webp:'image/webp',svg:'image/svg+xml'}[brandAsset[1]]) : null;
  const file = files.get(pathname) || ((mime || brandMime) ? [pathname.slice(1), mime || brandMime] : null);
  if (!file) {
    response.writeHead(404, { "Cache-Control": "no-store" });
    response.end("Not Found");
    return;
  }

  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, {
      "Content-Type": file[1],
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500, { "Cache-Control": "no-store" });
    response.end("Unable to read the requested app file");
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 100;
server.maxRequestsPerSocket = 100;
server.maxConnections = 256;

server.listen(port, "127.0.0.1", () => {
  console.log(`FifaBet Arena local: http://localhost:${port}`);
  console.log("Keep this terminal open while using the app. Press Ctrl+C to stop.");
});
