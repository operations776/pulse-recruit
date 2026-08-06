// PLS-104. Set the theme BEFORE the first paint.
//
// This has to be an inline script in <head>, not a useEffect. React effects run
// after hydration, which is after the browser has already painted, so a
// dark-mode user gets a full white frame on every single navigation. That
// flash is the entire reason this file exists.
//
// The rebrand this was ported from does not persist the theme at all: it reads
// prefers-color-scheme once and its toggle is in-memory, so the theme resets
// the moment you change page. That is fine for a static demo and wrong for a
// product somebody works in all day, so the choice is stored.
//
// Order of precedence:
//   1. What the user last chose, in localStorage. An explicit choice wins.
//   2. The OS preference, for somebody who has never touched the toggle.
//   3. Light.
//
// Wrapped in try/catch because localStorage throws outright in some privacy
// modes, and a theme preference is never worth a blank page.

export const THEME_KEY = "pulse.theme";

const script = `(function(){try{
var t=localStorage.getItem("${THEME_KEY}");
if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}
document.documentElement.setAttribute("data-theme",t);
}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export function ThemeScript() {
  // suppressHydrationWarning is not needed: this writes an attribute on <html>
  // rather than rendering markup React will diff.
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
