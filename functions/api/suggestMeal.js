
// functions/api/suggestMeal.js
// Note: @google/genai must be available in the Cloudflare Functions environment.
// Typically, for Cloudflare Pages Functions, you'd add dependencies to your project's package.json
// and Cloudflare would bundle them. If direct import doesn't work, you might need to adjust
// how dependencies are handled or use a version of the SDK compatible with CF Workers (e.g. via esm.sh if allowed).
// For now, this assumes @google/genai can be imported.
// If not, you'd need to use the Fetch API to call Gemini REST API directly.

// Placeholder for GoogleGenAI import. In a real CF Worker/Function environment,
// you'd need to ensure this dependency is correctly resolved.
// For simplicity in this example, we'll assume it's globally available or correctly bundled.
// import { GoogleGenAI } from "@google/genai"; // This might not work directly without bundling

// A more robust way for Cloudflare Functions if @google/genai isn't directly importable
// without a build step for the function itself, would be to use a dynamic import from a CDN
// or use the REST API directly.
// However, the guideline specifies using the SDK.

// Let's assume a bundler or CF's system makes this available:
// You would need to ensure your `package.json` includes "@google/genai"
// and your Cloudflare Pages build process bundles Functions correctly.

async function getGoogleGenAI(apiKey) {
  if (typeof GoogleGenAI === 'undefined') {
    // Attempt to dynamically import if not globally available (ESM-style)
    // This is a common pattern in environments like Deno or modern Workers.
    // Cloudflare Functions might have specific ways to handle external modules.
    try {
        const genAImodule = await import("https://esm.sh/@google/genai@^1.1.0");
        return new genAImodule.GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("Failed to dynamically import @google/genai:", e);
        throw new Error("GoogleGenAI SDK not available");
    }
  }
  return new GoogleGenAI({ apiKey });
}


export async function onRequestPost(context) {
  try {
    // Environment variables are available on context.env
    const apiKey = context.env.API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ message: "APIキーがサーバーに設定されていません。" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let ai;
    try {
        // Dynamically import GoogleGenAI as it might not be available globally in CF Pages Functions
        const genAIModule = await import('https://esm.sh/@google/genai@^1.1.0');
        ai = new genAIModule.GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI in Cloudflare Function:", e);
        return new Response(JSON.stringify({ message: "AI SDKの初期化に失敗しました。" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    
    const requestBody = await context.request.json();
    const userPrompt = requestBody.prompt;

    if (!userPrompt) {
      return new Response(JSON.stringify({ message: "プロンプトがリクエストに含まれていません。" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17", // Use the recommended model
        contents: userPrompt,
    });

    const suggestionText = response.text;

    return new Response(JSON.stringify({ suggestion: suggestionText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Cloudflare Function内でエラーが発生しました:", error);
    let errorMessage = "AIとの通信中にサーバーでエラーが発生しました。";
    if (error.message) {
        errorMessage = error.message;
    }
    // Check for specific error types if needed, e.g., authentication errors from Gemini
    if (error.toString().includes("API key not valid")) {
        errorMessage = "サーバーに設定されたAPIキーが無効です。管理者に連絡してください。";
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Optional: Handle other methods like GET for health check or OPTIONS for CORS if needed
export async function onRequestGet(context) {
  return new Response(JSON.stringify({ status: "OK", message: "AI Suggestion API is running." }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
