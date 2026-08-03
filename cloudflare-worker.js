export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // CORS Headers cho phép trình duyệt gọi API
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Xử lý Preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Xử lý Health Check từ Dashboard Admin (Ping bằng HEAD request)
    if (request.method === "HEAD") {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    // 1. API: Tải file vượt rào CORS (/download)
    if (url.pathname === "/download" && request.method === "POST") {
      try {
        const body = await request.json();
        const targetUrl = body.url;
        if (!targetUrl) return new Response("Missing URL", { status: 400, headers: corsHeaders });
        
        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          }
        });
        
        // Trả về file + gắn header cho phép tải từ frontend
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("Access-Control-Allow-Origin", "*");
        return newResponse;
      } catch (err) {
        return new Response(err.message, { status: 500, headers: corsHeaders });
      }
    }

    // 2. API: Convert Image (/convertImage)
    if (url.pathname === "/convertImage" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) return new Response("Missing file", { status: 400, headers: corsHeaders });
        
        return new Response(file, {
          headers: {
            ...corsHeaders,
            "Content-Type": file.type || "application/octet-stream",
          }
        });
      } catch (err) {
        return new Response(err.message, { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Huy Locket Media Service is running!", { status: 200, headers: corsHeaders });
  }
};
