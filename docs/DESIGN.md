# Lagani design and motion

Shared reference: `packages/design-tokens/tokens.json`. The original identity uses joining seed/branch forms, warm cream surfaces, purple actions and distinct editorial accents: yellow discovery, coral stories, lavender research and mint portfolio. Colors organize content; they never signify investment safety.

The investor navigation is Home, Explore, Portfolio, Activity and Profile. Owner and review workspaces are explicit secondary destinations. Financial views always identify virtual balances, pending allocations and simulated ownership. Numbers remain visible through transitions.

Spacing uses 4/8-point increments; major surfaces use 24px radii. Mobile targets are designed for at least 48 logical pixels. Focus outlines, labels, text alternatives for charts and scrollable layouts are required. Run `npm run test:contrast` for shared text/action token pairs; this check does not prove every rendered component meets WCAG AA.

Press feedback starts at 120ms, filters at 180ms, navigation at 240ms, shared business transitions at 300ms, and initial arrival at 400ms. Reduced-motion preferences remove decorative movement. Financial actions wait for server confirmation and never optimistically alter balances.

Fonts are bundled dependencies/assets with their upstream licenses. Code-native business illustrations and brand vectors are original to this project. Do not use remote image/font availability as a runtime dependency.

## Financial language glossary

| English | Nepali draft |
| --- | --- |
| Simulation | अभ्यास / सिमुलेसन |
| No real money | वास्तविक पैसा होइन |
| Virtual balance | भर्चुअल मौज्दात |
| Simulated ownership | अभ्यास स्वामित्व |
| Equity shares | स्वामित्व सेयर |
| Commitment | प्रतिबद्धता |
| Risk | जोखिम |
| Dilution | स्वामित्व प्रतिशत घट्नु |
| Available balance | उपलब्ध मौज्दात |

Translations, financial terms and disclosure wording require fluent Nepali human review before external release. Gregorian dates are displayed in Nepal time; no unsupported Bikram Sambat conversion is implied.
