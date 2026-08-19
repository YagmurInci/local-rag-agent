/**
 * Foundry Local chat engine.
 * Uses the Foundry Local SDK to discover, load, and run inference
 * on a local model. Performs RAG retrieval and generates responses.
 * Selects the hardware-optimised model variant automatically and
 * reports download/load progress via a status callback.
 */
import { FoundryLocalManager } from "foundry-local-sdk";
import { VectorStore } from "./vectorStore.js";
import { config } from "./config.js";
import { SYSTEM_PROMPT, SYSTEM_PROMPT_COMPACT } from "./prompts.js";

export class ChatEngine {
  constructor() {
    this.chatClient = null;
    this.model = null;
    this.store = null;
    this.compactMode = false;
    this.modelAlias = null;
    /** @type {(status: {phase: string, message: string, progress?: number}) => void} */
    this._statusCallback = null;
  }

  /** Register a callback that receives init status updates for the UI. */
  onStatus(callback) {
    this._statusCallback = callback;
  }

  _emitStatus(phase, message, progress) {
    const status = { phase, message, ...(progress !== undefined && { progress }) };
    console.log(`[ChatEngine] ${message}`);
    if (this._statusCallback) this._statusCallback(status);
  }

  /**
   * Initialize the engine: create Foundry Local manager, discover and load
   * the best model variant for this hardware, and open the vector store.
   */
  async init() {
    this._emitStatus("init", "Initializing Foundry Local SDK...");

    // Create the manager (requires appName)
    const manager = FoundryLocalManager.create({ appName: "software-architecture-api-rag" });
    const catalog = manager.catalog;

    this._emitStatus("catalog", "Discovering available models...");
    const baseModel = await catalog.getModel("phi-3.5-mini");

    // Select CPU variant
    let targetVariant = baseModel;
    if (baseModel.variants && baseModel.variants.length > 0) {
      const cpuVariant = baseModel.variants.find(v => v.id && v.id.toLowerCase().includes("cpu"));

      if (cpuVariant) {
        targetVariant = cpuVariant;
        console.log(`[ChatEngine] Selected CPU variant: ${targetVariant.id}`);
      }
    }

    this.model = targetVariant;
    this.modelAlias = this.model.id || this.model.alias || "phi-3.5-mini";

    this._emitStatus("variant", `Selected model: ${this.modelAlias}`);

    // Download the model if not already cached
    if (!this.model.isCached) {
      this._emitStatus("download", `Downloading ${this.modelAlias}... This may take a few minutes on first run.`, 0);
      await this.model.download((progress) => {
        const pct = Math.min(Math.round(progress * 100), 100);
        this._emitStatus("download", `Downloading ${this.modelAlias}... ${pct}%`, progress);
      });
      this._emitStatus("download", `Download complete.`, 1);
    } else {
      this._emitStatus("cached", `Model ${this.modelAlias} is already cached.`);
    }

    // Load the model into memory
    this._emitStatus("loading", `Loading ${this.modelAlias} into memory...`);
    await this.model.load();

    // Create the native chat client
    this.chatClient = this.model.createChatClient();
    this.chatClient.settings.temperature = 0.1;
    this._emitStatus("ready", `Model ready: ${this.modelAlias}`);

    // Open the local vector store
    this.store = new VectorStore(config.dbPath);
    const count = this.store.count();
    this._emitStatus("ready", `Vector store ready: ${count} chunks indexed.`);

    if (count === 0) {
      console.warn("[ChatEngine] WARNING: No documents ingested. Run 'npm run ingest' first.");
    }
  }

  /** Expose the vector store for direct operations (e.g. upload ingestion). */
  getStore() {
    if (!this.store) {
      this.store = new VectorStore(config.dbPath);
    }
    return this.store;
  }

  /**
   * Set compact mode for extreme latency / edge devices.
   */
  setCompactMode(enabled) {
    this.compactMode = enabled;
    console.log(`[ChatEngine] Compact mode: ${enabled ? "ON" : "OFF"}`);
  }

  /**
   * Retrieve relevant context from the local knowledge base.
   */
  retrieve(query) {
    const topK = this.compactMode ? Math.min(config.topK, 3) : config.topK;
    return this.getStore().search(query, topK);
  }

  /**
   * Format retrieved chunks into a context block for the prompt.
   */
  _buildContext(chunks) {
    if (chunks.length === 0) {
      return "No relevant documents found in local knowledge base.";
    }

    return chunks
      .map(
        (c, i) =>
          `--- Document ${i + 1}: ${c.title} [${c.category}] ---\n${c.content}`
      )
      .join("\n\n");
  }

  /**
   * Clean and format conversation history for LLM message array.
   */
  _cleanHistory(history = []) {
    if (!Array.isArray(history)) return [];
    return history
      .filter((h) => h && typeof h === "object" && typeof h.content === "string" && h.content.trim().length > 0)
      .map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.content.trim(),
      }));
  }

  /**
   * Generate a response for a user query (non-streaming).
   */
  async query(userMessage, history = []) {
    const chunks = this.retrieve(userMessage);
    const context = this._buildContext(chunks);
    const cleanHistory = this._cleanHistory(history);

    const systemPrompt = this.compactMode ? SYSTEM_PROMPT_COMPACT : SYSTEM_PROMPT;
    const fullSystemContent = `${systemPrompt}\n\nRetrieved context from local knowledge base:\n\n${context}`;

    const messages = [
      { role: "system", content: fullSystemContent },
      ...cleanHistory,
      { role: "user", content: userMessage.trim() },
    ];

    if (!this.chatClient) {
      throw new Error("Chat client is not initialized.");
    }

    this.chatClient.settings.maxTokens = this.compactMode ? 512 : 1024;
    const response = await this.chatClient.completeChat(messages);

    const text = response?.choices?.[0]?.message?.content || "No response generated.";

    return {
      text,
      sources: chunks.map((c) => ({
        title: c.title,
        category: c.category,
        docId: c.doc_id,
        score: Math.round(c.score * 100) / 100,
      })),
    };
  }

  /**
   * Generate a streaming response for a user query.
   * Returns an async iterable of chunks with robust error recovery.
   */
  async *queryStream(userMessage, history = []) {
    const chunks = this.retrieve(userMessage);
    const context = this._buildContext(chunks);
    const cleanHistory = this._cleanHistory(history);

    const systemPrompt = this.compactMode ? SYSTEM_PROMPT_COMPACT : SYSTEM_PROMPT;
    const fullSystemContent = `${systemPrompt}\n\nRetrieved context from local knowledge base:\n\n${context}`;

    const messages = [
      { role: "system", content: fullSystemContent },
      ...cleanHistory,
      { role: "user", content: userMessage.trim() },
    ];

    // 1. Yield sources metadata first
    yield {
      type: "sources",
      data: chunks.map((c) => ({
        title: c.title,
        category: c.category,
        docId: c.doc_id,
        score: Math.round(c.score * 100) / 100,
      })),
    };

    if (!this.chatClient) {
      yield { type: "error", data: "Chat client is not initialized." };
      return;
    }

    this.chatClient.settings.maxTokens = this.compactMode ? 512 : 1024;

    const textChunks = [];
    let resolveSignal = null;
    let done = false;
    let streamErr = null;

    const streamPromise = Promise.resolve()
      .then(() => {
        return this.chatClient.completeStreamingChat(messages, (chunk) => {
          textChunks.push(chunk);
          if (resolveSignal) {
            const r = resolveSignal;
            resolveSignal = null;
            r();
          }
        });
      })
      .then(() => {
        done = true;
        if (resolveSignal) {
          const r = resolveSignal;
          resolveSignal = null;
          r();
        }
      })
      .catch((err) => {
        console.error("[ChatEngine] Streaming error:", err);
        done = true;
        streamErr = err;
        if (resolveSignal) {
          const r = resolveSignal;
          resolveSignal = null;
          r();
        }
      });

    while (!done || textChunks.length > 0) {
      if (textChunks.length === 0 && !done) {
        await new Promise((r) => {
          resolveSignal = r;
        });
      }
      while (textChunks.length > 0) {
        const chunk = textChunks.shift();
        const content = chunk?.choices?.[0]?.delta?.content;
        if (content) {
          yield { type: "text", data: content };
        }
      }
    }

    await streamPromise;

    if (streamErr) {
      yield { type: "error", data: streamErr.message || "Model streaming error occurred." };
    }
  }

  close() {
    if (this.model) {
      this.model.unload().catch(() => {});
    }
    if (this.store) this.store.close();
  }
}
