export async function onRequest(context: { request: Request }): Promise<Response> {
  const url = new URL(context.request.url);
  const targetUrl = new URL(
    url.pathname + url.search,
    "https://faq-mate-api.json-panganiban.workers.dev"
  );
  return fetch(new Request(targetUrl, context.request));
}
