// The Node/API typecheck uses the standard Fetch types. The main Worker typecheck
// resolves the same bridge through @cloudflare/workers-types.
declare module "cloudflare:node" {
  export function handleAsNodeRequest(port: number, request: Request): Promise<Response>;
}
