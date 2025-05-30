
// functions/api/suggestMeal.js

// The @google/genai SDK is imported dynamically from esm.sh.
// This is a common approach for environments like Cloudflare Functions
// when a traditional build step with package.json bundling for the function
// itself is not explicitly configured or to ensure the latest compatible version is used.

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
        // Dynamically import the latest stable GoogleGenAI SDK from esm.sh
        // Using '@google/genai' without a specific version fetches the latest stable.
        const genAIModule = await import('https://esm.sh/@google/genai');
        
        if (!genAIModule || !genAIModule.GoogleGenAI) {
            console.error("GoogleGenAI class not found in the imported module from esm.sh. Module content:", genAIModule);
            throw new Error("Failed to load GoogleGenAI class from SDK via esm.sh.");
        }
        ai = new genAIModule.GoogleGenAI({ apiKey });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI in Cloudflare Function:", e);
        const detail = e instanceof Error ? e.message : String(e);
        return new Response(JSON.stringify({ message: `AI SDKの初期化に失敗しました: ${detail}` }), {
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

    // According to guidelines, response.text directly gives the string output.
    const suggestionText = response.text;

    if (suggestionText === undefined || suggestionText === null) {
        console.error("Gemini API returned no text in response object:", response);
        // Potentially inspect response.candidates[0].finishReason or safetyRatings if text is missing
        // For example: response?.candidates?.[0]?.finishReason !== 'STOP'
        throw new Error("AIからの応答にテキストが含まれていませんでした。APIからの応答を確認してください。");
    }

    return new Response(JSON.stringify({ suggestion: suggestionText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Cloudflare Function内でエラーが発生しました:", error);
    let errorMessage = "AIとの通信中にサーバーでエラーが発生しました。";
    if (error instanceof Error) {
        // Use the error message directly if it's an Error object
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    
    // Enhance error message for specific known issues
    if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("permission denied")) {
        errorMessage = "サーバーに設定されたAPIキーが無効か、権限がありません。管理者に連絡してください。";
    } else if (errorMessage.toLowerCase().includes("quota")) {
        errorMessage = "APIの利用上限に達した可能性があります。時間をおいて再度お試しください。";
    } else if (errorMessage.toLowerCase().includes("failed to fetch") || errorMessage.toLowerCase().includes("network error")) {
        errorMessage = "AIサービスへのネットワーク接続に失敗しました。インターネット接続を確認するか、時間をおいて再度お試しください。";
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
