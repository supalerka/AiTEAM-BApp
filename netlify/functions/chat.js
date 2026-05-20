// Netlify serverless function — proxies AI chat requests to Google Gemini API
// ใช้ gemini-pro ซึ่งมี Free Tier (ไม่เสียเงิน)
// ตั้งค่าใน Netlify → Site → Environment variables:
//   GEMINI_API_KEY = AIza... (จาก https://aistudio.google.com/app/apikey)

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "GEMINI_API_KEY ยังไม่ได้ตั้งค่าใน Netlify Environment Variables" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const { system, messages, max_tokens } = body;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, body: JSON.stringify({ error: "messages array is required" }) };
  }

  // แปลง Anthropic format → Gemini format
  // Anthropic: role "assistant" → Gemini: role "model"
  // Anthropic: content เป็น string → Gemini: parts: [{ text }]
  const geminiContents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "" }],
  }));

  const geminiBody = {
    system_instruction: system
      ? { parts: [{ text: system }] }
      : { parts: [{ text: "คุณคือ AI Assistant สำหรับระบบบริหารธุรกิจ ตอบเป็นภาษาไทยเสมอ กระชับและตรงประเด็น" }] },
    contents: geminiContents,
    generationConfig: {
      maxOutputTokens: max_tokens || 1000,
      temperature: 0.7,
    },
  };

  try {
   const model = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error?.message || `Gemini API error ${res.status}`;
      return {
        statusCode: res.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: errMsg }),
      };
    }

    // แปลง Gemini response → Anthropic-compatible format (frontend ใช้ data.content[0].text)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "ขออภัย ไม่สามารถตอบได้ในขณะนี้";
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        content: [{ type: "text", text }],
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "ไม่สามารถเชื่อมต่อ Gemini API ได้: " + err.message }),
    };
  }
};
