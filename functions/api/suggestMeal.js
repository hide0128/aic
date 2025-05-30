
// functions/api/suggestMeal.js

const GEMINI_API_MODEL = "gemini-2.5-flash-preview-04-17";

export async function onRequestPost(context) {
  try {
    const apiKey = context.env.API_KEY;

    if (!apiKey) {
      console.error("API_KEY is not set in Cloudflare Function environment.");
      return new Response(JSON.stringify({ message: "APIキーがサーバーに設定されていません。" }), {
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

    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_API_MODEL}:generateContent?key=${apiKey}`;

    const geminiRequestBody = {
      contents: [
        {
          parts: [
            {
              text: userPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7, // 応答のランダム性を高める (0.0 - 1.0)
        // topK: 1, // 必要に応じて設定
        // topP: 1, // 必要に応じて設定
        // maxOutputTokens: 2048, // 必要に応じて設定
      },
    };

    console.log(`Sending request to Gemini API: ${GEMINI_API_URL}`);
    const apiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(geminiRequestBody),
    });

    if (!apiResponse.ok) {
      let errorData;
      try {
        errorData = await apiResponse.json();
        console.error("Gemini API Error Response:", errorData);
      } catch (e) {
        console.error("Failed to parse Gemini API Error Response:", apiResponse.statusText);
        errorData = { error: { message: `Gemini API request failed with status: ${apiResponse.status} ${apiResponse.statusText}` } };
      }
      const errorMessage = errorData?.error?.message || `Gemini APIリクエストに失敗しました (${apiResponse.status})。`;
      // APIキー関連のエラーをより具体的に判定
      if (apiResponse.status === 400 && errorMessage.toLowerCase().includes("api key not valid")) {
         throw new Error("サーバーに設定されたAPIキーが無効です。管理者に連絡してください。");
      }
      if (apiResponse.status === 403 && errorMessage.toLowerCase().includes("permission denied")) {
         throw new Error("APIキーにGemini APIを利用する権限がありません。管理者に連絡してください。");
      }
      throw new Error(errorMessage);
    }

    const responseData = await apiResponse.json();
    
    // 生成されたテキストの抽出 (より安全なアクセス)
    const candidate = responseData?.candidates?.[0];
    if (!candidate) {
        let blockReason = responseData?.promptFeedback?.blockReason;
        if (blockReason) {
            console.warn(`Gemini API did not return candidates, prompt blocked. Reason: ${blockReason}`);
            throw new Error(`AIの応答がブロックされました。理由: ${blockReason}。不適切な内容が含まれていないか確認してください。`);
        }
        console.error("Gemini API response missing candidates:", responseData);
        throw new Error("AIからの応答に候補が含まれていませんでした。");
    }

    const textPart = candidate?.content?.parts?.[0]?.text;
    if (typeof textPart !== 'string') {
      console.error("Gemini API response missing text part or text is not a string:", candidate);
      const finishReason = candidate?.finishReason;
      const safetyRatings = candidate?.safetyRatings;
      let detailMessage = `AIからの応答にテキスト部分が見つかりませんでした。`;
      if (finishReason) detailMessage += ` 終了理由: ${finishReason}.`;
      if (safetyRatings) detailMessage += ` 安全性評価: ${JSON.stringify(safetyRatings)}.`;
      if (finishReason === "SAFETY") {
        detailMessage = `AIの応答が安全性基準によりブロックされました。不適切な内容が含まれていないか確認してください。評価: ${JSON.stringify(safetyRatings)}`;
      }
      throw new Error(detailMessage);
    }

    return new Response(JSON.stringify({ suggestion: textPart }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Cloudflare Function内でエラーが発生しました:", error);
    let errorMessage = "AIとの通信中にサーバーで予期せぬエラーが発生しました。";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    // エラーメッセージに基づいてフロントエンドに返すメッセージを調整
    const lowerErrorMessage = errorMessage.toLowerCase();
    if (lowerErrorMessage.includes("apiキーが無効") || lowerErrorMessage.includes("permission denied")) {
        // このメッセージはすでにスローされているので、ここでは一般的なメッセージでよい
    } else if (lowerErrorMessage.includes("quota")) {
        errorMessage = "APIの利用上限に達した可能性があります。時間をおいて再度お試しください。";
    } else if (lowerErrorMessage.includes("failed to fetch") || lowerErrorMessage.includes("network error")) {
        errorMessage = "AIサービスへのネットワーク接続に失敗しました。インターネット接続を確認するか、時間をおいて再度お試しください。";
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet(context) {
  // GETハンドラはヘルスチェックやAPIステータス確認のために維持
  return new Response(JSON.stringify({ status: "OK", message: "AI Suggestion API (REST via CF Function) is running." }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
