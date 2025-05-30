
// functions/api/suggestMeal.js

// The @google/genai SDK is imported dynamically from esm.sh.
// Attempting a more specific URL for esm.sh
const SDK_MODULE_URL = 'https://esm.sh/@google/genai?target=esnext&format=esm';

export async function onRequestPost(context) {
  try {
    // Environment variables are available on context.env
    const apiKey = context.env.API_KEY;

    if (!apiKey) {
      console.error("API_KEY is not set in Cloudflare Function environment.");
      return new Response(JSON.stringify({ message: "APIキーがサーバーに設定されていません。" }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let ai;
    try {
        console.log(`[DEBUG] Attempting to import SDK from specific esm.sh URL: '${SDK_MODULE_URL}'`);
        const genAIModule = await import(SDK_MODULE_URL); 
        
        if (!genAIModule || !genAIModule.GoogleGenAI) {
            console.error(`GoogleGenAI class not found in the imported module from ${SDK_MODULE_URL}. Module content:`, JSON.stringify(genAIModule));
            throw new Error(`Failed to load GoogleGenAI class from SDK via ${SDK_MODULE_URL}.`);
        }
        ai = new genAIModule.GoogleGenAI({ apiKey });
        console.log(`GoogleGenAI SDK initialized successfully from ${SDK_MODULE_URL}.`);
    } catch (e) {
        console.error(`Failed to import or initialize GoogleGenAI from ${SDK_MODULE_URL}:`, e);
        const detail = e instanceof Error ? e.message : String(e);
        // The error message "No such module 'https:/...'" might indicate a deeper issue
        // within the Cloudflare Functions runtime or its interaction with esm.sh.
        return new Response(JSON.stringify({ message: `AI SDKの初期化に失敗しました: ${detail}. Attempted SDK URL: ${SDK_MODULE_URL}` }), {
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
    
    console.log("Generating content with model gemini-2.5-flash-preview-04-17");
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-04-17",
        contents: userPrompt,
    });

    const suggestionText = response.text;

    if (suggestionText === undefined || suggestionText === null) {
        console.error("Gemini API returned no text in response object:", response);
        const finishReason = response?.candidates?.[0]?.finishReason;
        const safetyRatings = response?.candidates?.[0]?.safetyRatings;
        let detailMessage = `AIからの応答にテキストが含まれていませんでした。`;
        if (finishReason) detailMessage += ` Finish reason: ${finishReason}.`;
        if (safetyRatings) detailMessage += ` Safety ratings: ${JSON.stringify(safetyRatings)}.`;
        throw new Error(detailMessage);
    }

    return new Response(JSON.stringify({ suggestion: suggestionText }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Cloudflare Function内でエラーが発生しました:", error);
    let errorMessage = "AIとの通信中にサーバーでエラーが発生しました。";
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    
    const lowerErrorMessage = errorMessage.toLowerCase();
    if (lowerErrorMessage.includes("api key not valid") || lowerErrorMessage.includes("permission denied") || lowerErrorMessage.includes("authentication failed")) {
        errorMessage = "サーバーに設定されたAPIキーが無効か、権限がありません。管理者に連絡してください。";
    } else if (lowerErrorMessage.includes("quota")) {
        errorMessage = "APIの利用上限に達した可能性があります。時間をおいて再度お試しください。";
    } else if (lowerErrorMessage.includes("failed to fetch") || lowerErrorMessage.includes("network error")) {
        errorMessage = "AIサービスへのネットワーク接続に失敗しました。インターネット接続を確認するか、時間をおいて再度お試しください。";
    } else if (errorMessage.includes("No such module") && (errorMessage.includes("https:/") || errorMessage.includes("https%3a/"))) { 
        errorMessage = `AI SDKのインポートURLに予期せぬ問題が発生しているようです（例: 'https:/'）。これはCloudflare Functionsランタイムとesm.shとの間の問題である可能性があります。詳細: ${errorMessage}`;
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet(context) {
  // Keep the GET handler for health checks or simple API status
  return new Response(JSON.stringify({ status: "OK", message: "AI Suggestion API is running." }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
