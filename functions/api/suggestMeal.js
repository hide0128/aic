
// functions/api/suggestMeal.js

// The @google/genai SDK is imported dynamically from esm.sh.
// This is a common approach for environments like Cloudflare Functions
// when a traditional build step with package.json bundling for the function
// itself is not explicitly configured or to ensure the latest compatible version is used.

export async function onRequestPost(context) {
  const sdkImportUrl = 'https://esm.sh/@google/genai'; // Define the URL for clarity and logging

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
        console.log(`Attempting to import GoogleGenAI SDK from: ${sdkImportUrl}`);
        const genAIModule = await import(sdkImportUrl);
        
        if (!genAIModule || !genAIModule.GoogleGenAI) {
            console.error(`GoogleGenAI class not found in the imported module from ${sdkImportUrl}. Module content:`, genAIModule);
            throw new Error(`Failed to load GoogleGenAI class from SDK via ${sdkImportUrl}.`);
        }
        ai = new genAIModule.GoogleGenAI({ apiKey });
        console.log("GoogleGenAI SDK initialized successfully.");
    } catch (e) {
        console.error(`Failed to import or initialize GoogleGenAI from ${sdkImportUrl}:`, e);
        const detail = e instanceof Error ? e.message : String(e);
        // The error message "No such module 'https:/esm.sh/@google/genai'" strongly suggests a typo 
        // (single '/' after 'https:') in the import URL in the *running* code.
        // Ensure the deployed code uses 'https://' (double slash).
        return new Response(JSON.stringify({ message: `AI SDKの初期化に失敗しました: ${detail}. SDK URL: ${sdkImportUrl}` }), {
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
        throw new Error(`AIからの応答にテキストが含まれていませんでした。Finish reason: ${finishReason}, Safety ratings: ${JSON.stringify(safetyRatings)}`);
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
    
    if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("permission denied") || errorMessage.toLowerCase().includes("authentication failed")) {
        errorMessage = "サーバーに設定されたAPIキーが無効か、権限がありません。管理者に連絡してください。";
    } else if (errorMessage.toLowerCase().includes("quota")) {
        errorMessage = "APIの利用上限に達した可能性があります。時間をおいて再度お試しください。";
    } else if (errorMessage.toLowerCase().includes("failed to fetch") || errorMessage.toLowerCase().includes("network error")) {
        errorMessage = "AIサービスへのネットワーク接続に失敗しました。インターネット接続を確認するか、時間をおいて再度お試しください。";
    } else if (errorMessage.includes("No such module") && errorMessage.includes(sdkImportUrl.replace("https://","https:/"))) {
        errorMessage = `AI SDKのインポートに失敗しました。URLにタイプミスがある可能性があります（例: 'https:/' の代わりに 'https://'）。デプロイされたコードを確認してください。詳細: ${errorMessage}`;
    }


    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet(context) {
  return new Response(JSON.stringify({ status: "OK", message: "AI Suggestion API is running." }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
