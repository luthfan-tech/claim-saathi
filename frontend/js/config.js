/* ClaimSaathi frontend configuration
 * ------------------------------------------------------------------
 * DEMO MODE (default, works on GitHub Pages)
 *   Leave API_BASE_URL as "".
 *   All data is kept in this browser's localStorage.
 *
 * BACKEND MODE
 *   Set API_BASE_URL to your running Flask server, for example:
 *     window.CLAIMSATHI_CONFIG = { API_BASE_URL: "http://127.0.0.1:5000" };
 *   or a separately hosted backend:
 *     window.CLAIMSATHI_CONFIG = { API_BASE_URL: "https://my-claimsaathi.onrender.com" };
 *
 * The app NEVER switches modes by itself. If the backend cannot be
 * reached, an explicit connection error is shown instead.
 * ------------------------------------------------------------------ */
window.CLAIMSATHI_CONFIG = {
  API_BASE_URL: "",
};
