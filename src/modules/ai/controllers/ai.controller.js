import dotenv from "dotenv";

dotenv.config();

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/**
 * @swagger
 * /api/v1/ai/chat:
 *   post:
 *     summary: Proxy chat completion request to NVIDIA AI API
 *     description: >
 *       Forwards a chat completion request to the NVIDIA integrate API and returns
 *       the generated response. Keeps the NVIDIA API key server-side to avoid CORS
 *       and key exposure issues from the browser.
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Hello"
 *     responses:
 *       200:
 *         description: AI completion response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 content:
 *                   type: string
 *       400:
 *         description: Bad request
 *       500:
 *         description: NVIDIA API error
 */
export const aiChatController = async (req, res) => {
  try {
    const { message } = req.body;
    console.log(message)

    if (!message || typeof message !== "string") {
      return res.status(400).json({ success: false, error: "message is required" });
    }

    if (!process.env.NVIDIA_API_KEY) {
      return res.status(500).json({ success: false, error: "NVIDIA_API_KEY not configured" });
    }

    const sys_instruction = `{You are a travel booking assistant.

Extract travel details from the user's sentence.

Today's date is 2026-07-04.

Return ONLY valid JSON.

{
  "from": "",
  "to": "",
  "date": ""
}

Rules:
- No markdown.
- No explanations.
- No extra text.
- If a field is missing, return an empty string.
- Convert relative dates like "tomorrow" into YYYY-MM-DD.}`

    const response = await fetch(NVIDIA_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: "google/gemma-2-2b-it",
        messages: [{ role: "user", content: message + " " + sys_instruction }],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        success: false,
        error: `NVIDIA API error: ${response.status}`,
        details: errText,
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";

    return res.status(200).json({ success: true, content });
  } catch (error) {
    console.error("AI chat controller error:", error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};