// Tema dell'app: automatico (segue il telefono), chiaro o scuro.
// La scelta sta nell'attributo data-theme di <html> e in localStorage, così resta dopo la chiusura.

export const themes = [
  { value: 'auto', label: 'Automatico' },
  { value: 'light', label: 'Chiaro' },
  { value: 'dark', label: 'Scuro' },
];

export function getTheme() {
  return document.documentElement.dataset.theme ?? 'auto';
}

export function setTheme(value) {
  if (value === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = value;

  // localStorage può non essere disponibile (es. navigazione privata): lo ignoriamo
  try {
    if (value === 'auto') localStorage.removeItem('tema');
    else localStorage.setItem('tema', value);
  } catch (e) {}
}
