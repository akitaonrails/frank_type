import { Controller } from "@hotwired/stimulus"

const STORAGE_KEY = "frankType.theme"
const THEMES = ["current", "logo-rush"]

export default class extends Controller {
  static targets = ["button"]

  connect() {
    this.apply(this.storedTheme(), { persist: false })
  }

  set(event) {
    this.apply(event.params.theme)
  }

  apply(theme, { persist = true } = {}) {
    const selectedTheme = THEMES.includes(theme) ? theme : THEMES[0]
    document.documentElement.dataset.theme = selectedTheme
    this.updateButtons(selectedTheme)
    if (persist) this.storeTheme(selectedTheme)
    window.dispatchEvent(new CustomEvent("theme:change", { detail: { theme: selectedTheme } }))
  }

  updateButtons(selectedTheme) {
    this.buttonTargets.forEach((button) => {
      const active = button.dataset.themeThemeParam === selectedTheme
      button.classList.toggle("preference-link-active", active)
      button.setAttribute("aria-pressed", active.toString())
    })
  }

  storedTheme() {
    try {
      return window.localStorage.getItem(STORAGE_KEY)
    } catch (_error) {
      return THEMES[0]
    }
  }

  storeTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch (_error) {
      // Theme persistence is optional when storage is unavailable.
    }
  }
}
