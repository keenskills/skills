// Runs in <head> before the first paint so a returning visitor never sees the
// other theme flash. Only a stored choice sets data-theme; without one the CSS
// media query follows the system. Kept as a string so layout.tsx can inline it.
export const THEME_KEY = 'theme'
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}})()`

/** @param {'light'|'dark'} theme */
export const nextTheme = (theme) => (theme === 'dark' ? 'light' : 'dark')
