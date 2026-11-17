/* Static discovery only. Never imports app code, loads credentials, or connects to services. */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const repo = path.resolve(__dirname, "../..");
const sourceRoot = path.join(repo, "backend-server/apps/api/src");
const output = path.join(repo, "docs/production");
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(full);
  }
}
walk(sourceRoot);
files.sort();
const relative = file => path.relative(repo, file).replace(/\\/g, "/");
const parse = file => ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
const string = node => node && ts.isStringLiteralLike(node) ? node.text : undefined;
const compact = node => node.getText().replace(/\s+/g, " ");
const line = (source, node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
function visit(source, action) {
  const descend = node => { action(node); ts.forEachChild(node, descend); };
  descend(source);
}
function memberCall(node) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
  return { receiver: node.expression.expression.getText(), method: node.expression.name.text, args: [...node.arguments] };
}
function writeCsv(name, columns, rows) {
  const cell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
  fs.writeFileSync(path.join(output, name), [columns, ...rows].map(row => row.map(cell).join(",")).join("\n") + "\n");
}

const app = parse(path.join(sourceRoot, "app.ts"));
const mounts = new Map();
const defaultImports = new Map();
for (const statement of app.statements) {
  if (!ts.isImportDeclaration(statement) || !statement.importClause?.name) continue;
  const moduleName = string(statement.moduleSpecifier);
  if (moduleName?.startsWith(".")) {
    const modulePath = path.resolve(sourceRoot, moduleName.replace(/\.js$/, ".ts"));
    defaultImports.set(modulePath, statement.importClause.name.text);
  }
}
visit(app, node => {
  const call = memberCall(node);
  if (call?.receiver !== "app" || call.method !== "use" || string(call.args[0]) === undefined) return;
  for (const argument of call.args.slice(1)) {
    if (!ts.isIdentifier(argument) || !/Router$/.test(argument.text)) continue;
    const list = mounts.get(argument.text) ?? [];
    list.push({ prefix: string(call.args[0]), line: line(app, node), middleware: call.args.slice(1, -1).map(compact).join(" | ") });
    mounts.set(argument.text, list);
  }
});

const routes = [], sockets = [], schemas = [];
for (const file of files) {
  const source = parse(file);
  const routerMiddleware = [];
  const defaultExport = source.statements.find(statement => ts.isExportAssignment(statement));
  const defaultReceiver = defaultExport?.expression?.getText();
  visit(source, node => {
    const call = memberCall(node);
    if (!call) return;
    const { receiver, method, args } = call;
    if (method === "use" && /router$/i.test(receiver) && args[0] && string(args[0]) === undefined) {
      routerMiddleware.push({ receiver, position: node.pos, value: args.map(compact).join(" | ") });
    }
    if (["get", "post", "put", "patch", "delete", "options", "head", "all"].includes(method)
      && (receiver === "app" || /router$/i.test(receiver)) && string(args[0]) !== undefined) {
      const routePath = string(args[0]);
      const inherited = routerMiddleware.filter(item => item.receiver === receiver && item.position < node.pos).map(item => item.value).join(" | ");
      const direct = args.slice(1).filter(argument => !ts.isArrowFunction(argument) && !ts.isFunctionExpression(argument)
        && !(ts.isCallExpression(argument) && argument.expression.getText() === "asyncHandler")).map(compact).join(" | ");
      const candidates = receiver === "app" ? [{ prefix: "", line: line(source, node), middleware: "" }]
        : mounts.get(receiver === defaultReceiver ? (defaultImports.get(file) ?? receiver) : receiver)
          ?? [{ prefix: "UNRESOLVED", line: "", middleware: "" }];
      for (const mount of candidates) {
        const resolved = `${mount.prefix}${routePath === "/" ? "" : routePath}` || "/";
        routes.push([method.toUpperCase(), resolved, relative(file), line(source, node), receiver,
          mount.line, inherited, direct, mount.middleware, "NOT VERIFIED", "NOT VERIFIED", "NOT VERIFIED", "NOT VERIFIED"]);
      }
    }
    if ((receiver === "socket" || receiver === "io") && ["on", "use"].includes(method)) {
      sockets.push([receiver, method, args[0] ? compact(args[0]).slice(0, 150) : "", relative(file), line(source, node), "NOT VERIFIED"]);
    }
    if (file.includes(`${path.sep}models${path.sep}`) && method === "index") {
      schemas.push([path.basename(file, ".ts"), receiver, "schema.index", relative(file), line(source, node), args.map(compact).join(" | ")]);
    }
  });
  if (file.includes(`${path.sep}models${path.sep}`)) {
    visit(source, node => {
      if (!ts.isNewExpression(node) || !/(?:^|\.)Schema$/.test(node.expression.getText())) return;
      const fields = node.arguments?.[0];
      if (!fields || !ts.isObjectLiteralExpression(fields)) return;
      for (const property of fields.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        schemas.push([path.basename(file, ".ts"), property.name.getText(), "field-definition", relative(file), line(source, property), compact(property.initializer)]);
      }
    });
  }
}
fs.mkdirSync(output, { recursive: true });
writeCsv("endpoint-inventory.csv", ["method", "mounted_path", "source", "line", "router", "app_mount_line", "preceding_router_middleware", "route_middleware", "mount_middleware", "resource_policy_review", "operation_identity_review", "atomicity_review", "retry_review"], routes);
writeCsv("socket-inventory.csv", ["receiver", "registration", "event_or_middleware_expression", "source", "line", "policy_review"], sockets);
writeCsv("schema-inventory.csv", ["model_file", "field_or_schema", "kind", "source", "line", "declaration"], schemas);
console.log(JSON.stringify({ sourceFiles: files.length, httpEntries: routes.length, socketRegistrations: sockets.length, schemaDeclarations: schemas.length, output: relative(output) }));
