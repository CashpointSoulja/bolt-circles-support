import http from "node:http";
import handler from "serve-handler";

const port = Number(process.env.PORT || 4173);
http
  .createServer((req, res) => handler(req, res, { public: "public", directoryListing: false, rewrites: [{ source: "/", destination: "/index.html" }] }))
  .listen(port, () => console.log(`Support on Your Terms: http://localhost:${port}`));
