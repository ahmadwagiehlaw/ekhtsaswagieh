// src/index.js
var index_default = {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      // Or specific domain in production
      "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken })
      }
    );
    const verifyData = await verifyResponse.json();
    if (!verifyResponse.ok || !verifyData.users || verifyData.users.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/upload") {
      const fileName = url.searchParams.get("key");
      if (!fileName) {
        return new Response(JSON.stringify({ error: "Missing 'key' query parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      await env.BUCKET.put(fileName, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") || "application/octet-stream"
        }
      });
      return new Response(JSON.stringify({ success: true, key: fileName }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (request.method === "DELETE" && url.pathname === "/delete") {
      const fileName = url.searchParams.get("key");
      if (!fileName) {
        return new Response(JSON.stringify({ error: "Missing 'key' query parameter" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      await env.BUCKET.delete(fileName);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
