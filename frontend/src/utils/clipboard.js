/**
 * Copy text to clipboard with fallback for non-secure HTTP network contexts.
 * Modern browsers block `navigator.clipboard` when accessed via unencrypted HTTP IP addresses.
 */
export const copyToClipboard = async (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, using fallback:", err);
    }
  }

  // Fallback for HTTP non-secure context (e.g. http://10.150.251.18:5173)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Keep off-screen
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback clipboard copy failed:", err);
    return false;
  }
};
