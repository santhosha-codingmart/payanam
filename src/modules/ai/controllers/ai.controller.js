import aiConfig from "../../../config/ai.js";

export const aiChatController = async (req, res) => {
  try {
    const { message } = req.body;
    console.log(message);
    if (!message || typeof message !== "string") {
      return res.status(400).json({
        success: false,
        error: "message is required",
      });
    }
    if (!aiConfig.nvidia.apiKey) {
      return res.status(500).json({
        success: false,
        error: "NVIDIA_API_KEY not configured",
      });
    }
    const sys_instruction = `{You are a travel booking assistant.

Extract travel details from the user's sentence.

Today's date is ${new Date().toISOString().split("T")[0]}.

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
- Convert relative dates like "tomorrow" into YYYY-MM-DD.}`;

    const { userChat } = aiConfig.models;

    const response = await fetch(aiConfig.nvidia.baseUrl, {
      method: "POST",
      headers: aiConfig.getHeaders(),
      body: JSON.stringify({
        model: userChat.name,
        messages: [
          {
            role: "user",
            content: message + " " + sys_instruction,
          },
        ],
        temperature: userChat.temperature,
        top_p: userChat.topP,
        max_tokens: userChat.maxTokens,
        stream: userChat.stream,
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
    return res.status(200).json({
      success: true,
      content,
    });
  } catch (error) {
    console.error("AI chat controller error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
