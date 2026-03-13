# Every1.fun / Creatorland Design Guidelines

## Design Approach
**Reference-Based Approach**: Drawing inspiration from modern Web3 platforms (Friend.tech, Lens Protocol) combined with Gen Z social apps (BeReal, Dispo) to create an energetic, crypto-native creator economy platform. The design emphasizes vibrant colors, bold typography, and gamified interactions suitable for Gen Z creators.

## Core Design Elements

### A. Color Palette

**Primary Colors:**
- **Lime Green**: 89 95% 79% - Primary brand color for CTAs, highlights, active states
- **Vivid Magenta**: 314 83% 57% - Secondary brand for accents, badges, premium features
- **Deep Purple**: 270 30% 15% - Dark mode background base
- **Charcoal**: 240 10% 10% - Card backgrounds, elevated surfaces

**Supporting Colors:**
- **White/Off-white**: 0 0% 98% - Text on dark backgrounds
- **Gray-400**: 240 5% 65% - Secondary text, muted elements
- **Success Green**: 142 76% 56% - Positive metrics, gains
- **Warning Orange**: 25 95% 63% - Alerts, notifications

### B. Typography
**Font Family**: Forma DJR Micro (custom implementation)
- **Headings**: Bold (700) - Large profile names, section titles
- **Subheadings**: Medium (500) - Card titles, navigation items
- **Body**: Regular (400) - Descriptions, chat messages
- **Metrics**: Bold (700) - Stats, trading data, percentages

**Type Scale**:
- Hero/Profile Names: text-4xl to text-5xl
- Section Headers: text-2xl to text-3xl
- Card Titles: text-lg to text-xl
- Body/UI: text-sm to text-base
- Captions/Labels: text-xs

### C. Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8 for consistent rhythm
- Component padding: p-4, p-6, p-8
- Card gaps: gap-4, gap-6
- Section spacing: py-8, py-12, py-16
- Max container width: max-w-7xl for desktop, max-w-full for mobile

**Grid System**:
- Mobile: Single column (grid-cols-1)
- Tablet: 2 columns for cards (md:grid-cols-2)
- Desktop: 3-4 columns for creator grids (lg:grid-cols-3, xl:grid-cols-4)

### D. Component Library

**Navigation**:
- Sticky top navigation with logo, search, and profile access
- Bottom tab bar for mobile (Home, Explore, Create, Messages, Profile)
- Glass morphism effect with backdrop-blur for floating elements

**Cards**:
- Rounded corners (rounded-2xl)
- Dark backgrounds with subtle gradients
- Hover states with scale transform (hover:scale-105 transition)
- Creator cards: Avatar, name, stats (followers/engagement), Connect button

**Buttons**:
- Primary: Lime green background, black text, bold weight
- Secondary: Magenta background, white text
- Outline: Transparent with lime/magenta border, backdrop-blur when on images
- Sizes: Small (px-3 py-1.5), Medium (px-4 py-2), Large (px-6 py-3)

**Forms & Inputs**:
- Dark backgrounds (bg-charcoal) with lime green focus rings
- Rounded borders (rounded-lg)
- Placeholder text in gray-400
- Search bars with magnifying glass icon

**Stats & Metrics**:
- Large bold numbers in white
- Labels in gray-400 below
- Percentage changes in success green (positive) or red (negative)
- Compact grid layout (grid-cols-3 gap-4)

**Trading Charts**:
- Line charts with lime green gradients
- Magenta accent for key data points
- Dark grid backgrounds
- Time period selectors (1H, 24H, 7D, 30D, ALL)

**Profile Components**:
- Large circular avatars with lime green border rings
- Tab navigation (Portfolio/Analytics/Groups/Bookmarks) with underline indicators
- Connection count and profile view graphs
- Bio sections with limited character display

**Messaging**:
- Chat bubbles with timestamp
- Request/Invitation tabs
- Unread badges in magenta
- Avatar thumbnails in conversation list

### E. Animations
Use sparingly for polish:
- Smooth transitions on hover (transition-transform duration-200)
- Fade-in for modals and overlays
- Slide-up animations for bottom sheets on mobile
- Subtle pulse on new notifications

## Page-Specific Guidelines

**Home/Explore**: Grid of creator cards with filters at top, trending section with horizontal scroll on mobile

**Creator Profile**: Hero section with cover image potential, large avatar, stats row, tabbed content below

**Minting Flow**: Step-by-step wizard with progress indicator, URL input or file upload, preview before minting

**Trading Interface**: Full-width chart at top, buy/sell controls below, transaction history in cards

**Inbox/Messages**: Two-column on desktop (conversation list + active chat), full-screen chat on mobile

**Projects Showcase**: Masonry grid of project cards with campaign metrics, prominent ADD PROJECT CTA

**Groups**: Grid of group cards with member counts, category badges in magenta

## Images
- **Profile Covers**: Optional wide banner images (16:9 ratio) for creator profiles with gradient overlays
- **Creator Avatars**: Circular profile images with lime green ring borders
- **Project Thumbnails**: Square or 4:3 cards with rounded corners
- **Trading Charts**: Dynamic SVG visualizations (not static images)
- No large hero image - platform jumps straight into functionality with navigation and content grids

## Mobile Optimization
- Bottom navigation bar (56px height) with 5 icons
- Full-width cards with reduced padding (p-4 vs p-6)
- Horizontal scroll for stats and trending sections
- Modal overlays for forms and detail views
- Swipe gestures for tab navigation