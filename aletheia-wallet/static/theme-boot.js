// Applies the saved theme and motion preference before first paint. Non-sensitive preferences only.
(function () {
  var root = document.documentElement;
  root.removeAttribute("data-theme-pending");
  try {
    var prefs = JSON.parse(localStorage.getItem("aletheia-wallet:prefs") || "{}");
    if (prefs.theme === "light" || prefs.theme === "dark") root.setAttribute("data-theme", prefs.theme);
    var reduce = prefs.motion === "reduce" || (prefs.motion !== "full" && matchMedia("(prefers-reduced-motion: reduce)").matches);
    root.setAttribute("data-motion", reduce ? "reduce" : "full");
  } catch (e) {
    root.setAttribute("data-motion", matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduce" : "full");
  }
})();
