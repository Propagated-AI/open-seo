function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getForwardedProtocol(request: Request) {
  const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto"));
  return protocol === "http" || protocol === "https" ? protocol : null;
}

export function getPublicOrigin(request: Request) {
  const url = new URL(request.url);
  // Vite can combine the forwarded HTTPS scheme with Caddy's loopback Host.
  // Recover the public host in that case; public HTTPS URLs remain authoritative.
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol === "https:" && !isLoopback) {
    return url.origin;
  }

  const protocol = getForwardedProtocol(request);
  const host = firstHeaderValue(request.headers.get("x-forwarded-host"));

  if (!protocol || !host) {
    return url.origin;
  }

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return url.origin;
  }
}

export function requestWithPublicOrigin(request: Request) {
  const url = new URL(request.url);
  const publicOrigin = getPublicOrigin(request);

  if (url.origin === publicOrigin) {
    return request;
  }

  const publicUrl = new URL(
    `${url.pathname}${url.search}${url.hash}`,
    publicOrigin,
  );
  return new Request(publicUrl, request);
}
