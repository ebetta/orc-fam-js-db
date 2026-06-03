---
name: Modern Wealth
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#9d4300'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff7e2d'
  on-tertiary-container: '#622700'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#ffdbca'
  tertiary-fixed-dim: '#ffb690'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#783200'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max-width: 1280px
---

## Brand & Style

The brand personality is **professional, reliable, and encouraging**. It is designed for families and individuals seeking clarity and control over their financial lives. The UI avoids the cold, clinical feel of traditional banking apps, opting instead for a **Corporate Modern** style with **Minimalist** influences. 

The aesthetic focuses on "Quiet Premium"—high-quality typography, generous whitespace, and subtle depth that makes complex financial data feel manageable and calm. The visual response should be one of confidence and order, transforming the chore of budgeting into a rewarding, streamlined experience.

## Colors

The palette refines the existing functional associations while elevating the overall tone:
- **Primary (Green/Lucros):** A vibrant but balanced Emerald (#10B981) for positive balances, growth, and dashboard successes.
- **Secondary (Blue/Transações):** A sophisticated Indigo (#6366F1) used for transaction histories, systemic actions, and navigational cues.
- **Tertiary (Orange/Orçamentos):** A warm, warning-conscious Amber (#F97316) for budget planning and active limits.
- **Surface & Neutrals:** A range of cool grays (Slate) provides the foundation. Backgrounds utilize a very light tint (#F8FAFC) to separate from white cards, while borders use a soft, low-contrast gray (#E2E8F0).

For accessibility, use WCAG 2.1 compliant contrast ratios, especially when overlaying white text on colored banners or headers.

## Typography

This design system utilizes **Inter** exclusively to ensure a clean, systematic, and highly legible experience across all platforms. 

- **Numerical Data:** For financial values (currency), use Medium (500) or SemiBold (600) weights to ensure they stand out as the primary focus points.
- **Hierarchy:** Use larger weights (Bold 700) for section titles and light grays for secondary labels to create clear visual scannability.
- **Line Heights:** Generous line heights are maintained to prevent data density from feeling overwhelming.

## Layout & Spacing

The layout follows a **Fluid Grid** model with fixed maximum constraints for desktop to ensure readability.

- **Grid:** Use a 12-column grid for desktop and a 4-column grid for mobile.
- **Margins & Gutters:** A standard 24px gutter provides ample breathing room between cards and navigation elements. 
- **Rhythm:** Spacing follows a 4px baseline. Use 16px (4 units) for internal card padding and 24px-32px (6-8 units) for major section spacing.
- **Density:** Maintain high whitespace ratios. Information density should be managed through progressive disclosure or card-based grouping rather than crowding the screen.

## Elevation & Depth

Hierarchy is established through **Tonal Layers** and **Ambient Shadows**:

- **Layering:** The primary background is the lowest level (Level 0). Cards and containers sit on Level 1, using a pure white fill to "pop" against the off-white background.
- **Shadows:** Use extra-diffused, soft shadows with a low opacity (4-6%). Shadows should feel like ambient light rather than a hard drop.
- **Interactive States:** On hover, cards should slightly increase their shadow spread (Level 2) or subtly lift to indicate interactivity.
- **Borders:** Use a subtle 1px border (#E2E8F0) in conjunction with shadows to define shapes clearly without adding visual weight.

## Shapes

The design system employs a **Rounded** language to soften the serious nature of financial management.

- **Standard Elements:** Use a 0.5rem (8px) radius for buttons and input fields.
- **Container Elements:** Use a 1rem (16px) radius for cards and dashboard widgets.
- **Large Banners:** Header cards or "Hero" sections (like the current orange/blue banners) should use the `rounded-xl` (1.5rem / 24px) setting to create a friendly, modern container feel.

## Components

- **Buttons:** Primary buttons use solid fills with white text. Secondary buttons use a light tint of the primary color with dark text. Transition states (hover/active) should involve a 10% brightness shift.
- **Cards:** All data should be housed in cards. Cards feature a white background, 1px soft border, and the standard Level 1 shadow. Headers within cards should be clearly separated by 16px of padding.
- **Progress Bars:** Use a 8px height with fully rounded caps (pill-shaped). The "track" should be a light gray, while the "fill" uses the functional color (Green for progress, Red for over-budget).
- **Inputs:** Fields should have a subtle gray background (#F1F5F9) that turns white on focus, with a 2px secondary-colored border.
- **Lists:** Transaction lists should use high-contrast text for values and low-contrast text for dates/descriptions. Use subtle dividers (1px) that don't span the full width of the card.
- **Chips/Badges:** Use "Soft" roundedness for category tags (Lazer, Saúde) with high-legibility small-caps or label-md typography.