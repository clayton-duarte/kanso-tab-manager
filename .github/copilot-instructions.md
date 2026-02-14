# Kanso Tab Manager - Development Guidelines

## UI Component Standards

### Chakra UI Usage

This project uses **Chakra UI v3** with vanilla components. Follow these rules:

1. **No Custom Hover/Focus/Selected Overrides**
   - Do NOT use `_hover`, `_focus`, `_selected` props to override default Chakra styles
   - Let Chakra handle interactive states automatically

2. **Use `colorPalette` with Accent Color Only**
   - Always use `colorPalette={accentColor}` from the store
   - **NEVER hardcode colors** like `colorPalette="red"`, `colorPalette="green"`, `colorPalette="blue"`
   - The only exception is when no color is needed (use no colorPalette at all)

3. **Input Components**
   - Use `variant="outline"` for all inputs
   - Do NOT override `bg`, `color`, `borderColor` - let Chakra dark mode handle it

4. **Button Variants**
   - `variant="solid"` for primary actions
   - `variant="outline"` for secondary actions
   - `variant="ghost"` for subtle actions

### Accent Color System

The app supports dynamic accent colors stored in user preferences:

- Available colors: `gray`, `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `cyan`, `purple`, `pink`
- Access via: `const { accentColor } = useAppStore()`
- Apply via: `colorPalette={accentColor}`

### Dark Mode

- Dark mode is enforced via `data-color-mode="dark"` on the HTML element
- Do NOT add custom dark mode overrides - Chakra handles it
- Background colors use semantic tokens from Chakra's dark theme

## Code Style

- Functional components with hooks only (no class components)
- TypeScript for all files
- Use `@/` path alias for imports from `src/`
