export function GET() {
  return Response.json({
    status: "ok",
    service: "one-odin",
    timestamp: new Date().toISOString(),
  });
}
