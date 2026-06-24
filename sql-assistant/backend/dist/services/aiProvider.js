"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAICompletion = void 0;
const callGemini = async (messages, model) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not defined.');
    }
    // Separate system instruction from user messages
    const systemInstruction = messages.find((m) => m.role === 'system')?.content;
    const userMessages = messages.filter((m) => m.role !== 'system');
    const contents = userMessages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
    }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const payload = { contents };
    if (systemInstruction) {
        payload.systemInstruction = {
            parts: [{ text: systemInstruction }],
        };
    }
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API error (${res.status}): ${errorText}`);
    }
    const data = (await res.json());
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('No text response returned from Gemini API.');
    }
    return text;
};
const callOpenAI = async (messages, model, apiKey, baseUrl) => {
    if (!apiKey) {
        throw new Error('API key is not defined for the selected provider.');
    }
    const url = `${baseUrl}/chat/completions`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages,
        }),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenAI-compatible API error (${res.status}): ${errorText}`);
    }
    const data = (await res.json());
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
        throw new Error('No text response returned from OpenAI-compatible API.');
    }
    return text;
};
const callOllama = async (messages, model) => {
    const host = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const url = `${host}/api/chat`;
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
        }),
    });
    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Ollama API error (${res.status}): ${errorText}`);
    }
    const data = (await res.json());
    const text = data.message?.content;
    if (!text) {
        throw new Error('No text response returned from Ollama API.');
    }
    return text;
};
const getAICompletion = async (messages) => {
    let provider = process.env.AI_PROVIDER;
    // Auto-detect provider if not explicitly configured
    if (!provider) {
        if (process.env.GEMINI_API_KEY) {
            provider = 'gemini';
        }
        else if (process.env.OPENAI_API_KEY) {
            provider = 'openai';
        }
        else if (process.env.DEEPSEEK_API_KEY) {
            provider = 'deepseek';
        }
        else {
            provider = 'ollama';
        }
    }
    // Set default models based on selected provider
    const defaultModel = provider === 'gemini'
        ? 'gemini-2.5-flash'
        : provider === 'openai'
            ? 'gpt-4o-mini'
            : provider === 'deepseek'
                ? 'deepseek-chat'
                : 'deepseek-coder';
    const model = process.env.DEFAULT_AI_MODEL || defaultModel;
    switch (provider) {
        case 'gemini':
            return callGemini(messages, model);
        case 'openai':
            return callOpenAI(messages, model, process.env.OPENAI_API_KEY, process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
        case 'deepseek':
            return callOpenAI(messages, model, process.env.DEEPSEEK_API_KEY, process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com');
        case 'ollama':
            return callOllama(messages, model);
        default:
            throw new Error(`Unsupported AI Provider: ${provider}`);
    }
};
exports.getAICompletion = getAICompletion;
