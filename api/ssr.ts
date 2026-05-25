import serverEntry from "../src/server";

function nodeRequestToWebRequest(req: any): Request {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "localhost";
  const url = new URL(req.url, `${protocol}://${host}`);

  return new Request(url.toString(), {
    method: req.method,
    headers: req.headers,
    body: req.method === "GET" || req.method === "HEAD" ? null : req,
  });
}

export default async function handler(req: any, res: any) {
  try {
    const request = nodeRequestToWebRequest(req);
    const response = await serverEntry.fetch(request, {}, {});

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    const body = await response.arrayBuffer();
    res.end(Buffer.from(body));
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end("Internal Server Error");
  }
}
