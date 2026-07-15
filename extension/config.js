/**
 * Hyperfi Reader - Extension Configuration & Environment Settings
 * Easily switch between local development and production cloud endpoints.
 */
const CONFIG = {
  // Set to 'production' when submitting to Chrome Web Store, or 'development' for local dev testing
  ENV: "development",

  DEVELOPMENT: {
    APP_URL: "http://localhost:3001",
    TTS_URL: "http://localhost:4000",
    COOKIE_NAME: "__session", // Clerk dev session cookie
  },

  PRODUCTION: {
    APP_URL: "https://app.hyperfi.ai",
    TTS_URL: "https://tts.hyperfi.ai",
    COOKIE_NAME: "__session", // Clerk prod session cookie
  },

  get endpoints() {
    return this.ENV === "production" ? this.PRODUCTION : this.DEVELOPMENT;
  },

  get APP_URL() {
    return this.endpoints.APP_URL;
  },

  get TTS_URL() {
    return this.endpoints.TTS_URL;
  },

  get COOKIE_NAME() {
    return this.endpoints.COOKIE_NAME;
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;
} else if (typeof globalThis !== "undefined") {
  globalThis.CONFIG = CONFIG;
}
