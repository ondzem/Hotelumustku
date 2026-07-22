# Pravidla a pokyny pro tlačítka v projektu Hotel u Můstku

## 🔘 Pravidlo pro tlačítka ve všech sekcích (Button Design System)

Všechna tlačítka napříč celým webem (Hero, Zázemí/O nás, Sleva sekce, Nabídka pokojů, Služby atd.) MUSÍ přísně dodržovat stejný systém proporcí:

### 1. Rozměry a typografie
* **Výška**:
  * Standardní desktop (1440px): `45px`
  * Velký desktop (1750px+): `48px`
  * Ultra-wide 4K (2200px+): `52px`
* **Typografie**:
  * Font-size: `17px` (1440px), `18px` (1750px+), `19.5px` (2200px+)
  * Font-weight: `500` (Medium)
  * Radius: `1px` (`border-radius: 1px`)

### 2. Konzistentní boční padding (Postranní odsazení)
* Šířka všech tlačítek se vypočítává z délky textu + stejného bočního paddingu:
  * Standardní desktop (1440px): `padding: 0 28px;`
  * Velký desktop (1750px+): `padding: 0 32px;`
  * Ultra-wide 4K (2200px+): `padding: 0 36px;`
* Pravidlo: `width: fit-content` / `display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;`
