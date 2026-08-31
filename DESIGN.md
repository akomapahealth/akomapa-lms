---
name: Akomapa Academy
description: Global health education and leadership training, built as a reading room you can carry into the field.
colors:
  atlantic-teal: "hsl(189 100% 35%)"
  atlantic-teal-deep: "hsl(188 97% 36%)"
  atlantic-teal-bright: "hsl(190 69% 44%)"
  harbour-deep: "hsl(187 80% 14%)"
  harmattan-gold: "hsl(44 83% 55%)"
  morning-ice: "hsl(189 47% 89%)"
  shallow-ice: "hsl(189 47% 78%)"
  paper: "hsl(185 18% 97%)"
  card-white: "hsl(0 0% 100%)"
  ink: "hsl(215 28% 17%)"
  ink-muted: "hsl(215 17% 50%)"
  hairline: "hsl(189 30% 85%)"
  affirm: "hsl(160 60% 34%)"
  caution: "hsl(32 90% 42%)"
  refuse: "hsl(0 84% 60%)"
  night-ink: "hsl(215 28% 10%)"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  full: "9999px"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "4rem"
components:
  button-primary:
    backgroundColor: "{colors.atlantic-teal}"
    textColor: "{colors.card-white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.5rem"
  button-secondary:
    backgroundColor: "{colors.morning-ice}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.5rem"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.5rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.5rem"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.5rem"
  sidebar:
    backgroundColor: "{colors.harbour-deep}"
    textColor: "{colors.morning-ice}"
    padding: "1rem"
    width: "16rem"
---

# Design System: Akomapa Academy

Approved by Prince Agyei Tuffour (@nanaagyei) on 2026-08-30 under issue
[#36](https://github.com/akomapahealth/akomapa-lms/issues/36). Product truth
lives in [PRODUCT.md](PRODUCT.md); domain language lives in
[CONTEXT.md](CONTEXT.md). This file is strictly visual and is normative: the
frontmatter tokens are the machine-readable contract, and their authored source
is `app/globals.css` and `tailwind.config.ts`. Prose never restates a token
value.

## Overview

**Creative North Star: "The Reading Room and the Field Notebook"**

One system with two named expressions, bound by surface mode. The **Reading
Room** governs the surfaces where someone is deciding or verifying:
`app/(marketing)/`, `app/verify/`, and the legal pages. There the deep harbour
ground opens up, Fraunces is given room, the measure is generous, and there is
ceremony, because a Certificate and a mission deserve weight. The **Field
Notebook** governs the surfaces where someone is working:
`app/(dashboard)/` and `app/(course)/`. There the ground goes pale, structure
becomes ruling rather than ornament, density rises, and the interface gets out
of the way of the material. Same palette, same type, different ceremony.

The character is precise and unhurried, and warm to the touch. Borders are
hairlines, padding is generous, transitions are calm rather than snappy, and
focus is unmistakable. Corners are softened and interactive elements answer to
the pointer with a small, honest lift. The two halves are held together by
restraint: the primary action on any screen is obvious from placement and
weight, never from volume. Nothing here is trying to keep anyone on the
platform.

What this system rejects, per [PRODUCT.md](PRODUCT.md#anti-references): the
marketplace catalogue, the gamified nudge, the grey clinical console, and the
charity appeal. Practically that means no ratings or enrolment-count social
proof, no streak-break pressure or mascots, no dense chromeless data grids as a
default, and no imagery of people receiving rather than working.

**Key Characteristics:**

- Deep harbour teal as shelter, pale ice as the working ground.
- Gold is earned, never decorative.
- Serif display against a geometric sans body; hierarchy from contrast, not size alone.
- Flat at rest, lifted only by intent.
- Hairlines and generous padding rather than boxes inside boxes.
- Legible on a mid-range phone in bright light before it is beautiful on a laptop.

## Colors

A cool coastal palette warmed by a single earth accent: the water of the Gulf
of Guinea against harmattan light. Names are place-rooted so the palette has a
story that is not the healthcare-teal reflex.

### Primary

- **Atlantic Teal** (`--primary`, `--akomapa-teal`, `--ring`): the brand voice
  and the single interactive colour. Primary buttons, active navigation, links,
  focus rings, progress fills, and the completed segment of any chart. If
  something is the main thing to do, it is this colour.
- **Atlantic Teal Deep** (`--akomapa-teal-dark`): pressed and hovered states of
  Atlantic Teal surfaces, and the darker stop of the marketing hero gradient.
- **Atlantic Teal Bright** (`--akomapa-teal-light`): a lighter sibling for dark
  mode primaries and for data-visualisation series that must be distinguished
  from Atlantic Teal.

### Secondary

- **Harbour Deep** (`--surface-deep`, `--sidebar-bg`): the Reading Room ground
  and the persistent sidebar. It is a place, not an accent. Used full bleed on
  marketing sections, the certificate teaser, and the whole desktop sidebar,
  never as a small block of colour.
- **Morning Ice** (`--secondary`, `--muted`, `--input`, `--akomapa-ice`): the
  quiet fill. Secondary buttons, input grounds, muted panels, table zebra, and
  chips. Carries most of the non-white surface area in the Field Notebook.
- **Shallow Ice** (`--akomapa-light-blue`): a mid step between Morning Ice and
  Atlantic Teal, for chart series, timeline rails, and disabled progress.

### Tertiary

- **Harmattan Gold** (`--accent`, `--akomapa-gold`, `--sidebar-accent`): the
  mark of recognition. Certificates, Badges, earned achievements, the active
  item in the sidebar rail, and nothing else. It is the only colour in the
  system that means "you did this."

### Neutral

- **Paper** (`--background`): the Field Notebook ground, an off-white tinted
  toward the brand hue. Never pure white.
- **Card White** (`--card`, `--popover`): raised reading surfaces sitting on
  Paper. The one place a pure white is permitted, because it is the page you
  read on.
- **Ink** (`--foreground`, `--card-foreground`): all primary text.
- **Ink Muted** (`--muted-foreground`): secondary text, captions, timestamps,
  placeholder text, and column headers. Never used for anything a learner must
  act on.
- **Hairline** (`--border`): every border in the system.
- **Night Ink** (dark mode `--background`): the dark theme ground.

### Status

- **Affirm** (`--success`): correct Quiz answers, passed post-tests, completed
  Modules, successful verification at `/verify`.
- **Caution** (`--warning`): time running out, unsaved work, locked content
  with a path to unlock, degraded connectivity.
- **Refuse** (`--destructive`): incorrect answers, failed actions, destructive
  confirmations, and access denials.

### Named Rules

**The Earned Gold Rule.** Harmattan Gold marks achievement and nothing else. It
never appears on a call to action, a marketing flourish, a chart series chosen
for variety, or an empty state. If a learner has not earned it, it is not gold.

**The Two Grounds Rule.** A surface is either Harbour Deep or Paper. Those are
the only two grounds in the system. A screen that needs a third ground has a
structure problem, not a colour problem.

**The Never Pure Black Rule.** No `#000` and no untinted grey. Every neutral is
tinted toward the brand hue, and text is Ink or Ink Muted, never a raw
greyscale value.

**The Colour Is Never Alone Rule.** Correctness, status, progress, and locked
state must be carried by text, icon, or position in addition to colour. A
learner with a colour vision deficiency, or reading in bright sun, must reach
the same conclusion.

## Typography

**Display Font:** Fraunces (with Georgia, serif), variable, with the `SOFT`,
`WONK`, and `opsz` axes enabled.
**Body Font:** Outfit (with system-ui, sans-serif).

**Character:** Fraunces is a soft, slightly wonky old-style serif; it carries
warmth and a scholarly voice without stiffness, which is why it holds the
Reading Room. Outfit is a clean geometric sans that stays legible at small
sizes on a phone, which is why it does all the work in the Field Notebook. The
pairing gives hierarchy through contrast of voice, so headings do not have to
shout to be found.

### Hierarchy

- **Display** (Fraunces, 600, fluid 2rem to 3.5rem, 1.1): the marketing hero,
  the certificate teaser, and the Course title on a Course landing page. At most
  one per screen.
- **Headline** (Fraunces, 600, 1.875rem, 1.2): marketing section openers, Quiz
  result headlines, and the empty-state heading that names what is missing.
- **Title** (Outfit, 600, 1.5rem, 1.25): page titles inside the app, card
  titles, Module names. The Field Notebook does not use Fraunces for routine
  titles.
- **Body** (Outfit, 400, 1rem, 1.6): all reading text. Measure is capped at 65
  to 75 characters on every surface, including Topic text content and Journal
  entries.
- **Label** (Outfit, 500, 0.875rem, 1.25): buttons, form labels, navigation,
  table headers, chips, and metadata.

### Named Rules

**The Serif Is For Voice Rule.** Fraunces speaks when the product is speaking:
mission, welcome, achievement, verification. Outfit speaks when the interface is
speaking: labels, controls, data, navigation. A serif button label is always
wrong.

**The Measure Rule.** No line of reading text exceeds 75 characters, at any
breakpoint, in any container. Wide viewports get wider margins, not wider text.

**The One Display Rule.** One Display-size element per screen. A page with two
things shouting has nothing to say.

## Layout

The app runs on a fixed shell and the marketing site runs on a centred
editorial column.

**App shell** (`components/shell/`): a persistent sidebar of 16rem on the left
at 768px and above, a header of 4rem (`--header-height`) across the top, and a
scrolling content region. The sidebar is core navigation and is guaranteed to
render at and above 768px by a plain-CSS rule (`.app-shell-sidebar`) that sits
outside every Tailwind layer, deliberately, so that utility-generation changes
can never remove it. Below 768px the sidebar becomes a sheet driven by
`components/shell/mobile-nav.tsx`, and the header carries the trigger.

**Marketing** (`app/(marketing)/`): a centred container, 2rem of horizontal
padding, capping at 1400px. Full-bleed Harbour Deep bands alternate with Paper
bands to give the page its rhythm; section spacing is roughly 4rem and up,
noticeably larger than anything in the app.

**Breakpoints:** Tailwind defaults (`sm` 640px, `md` 768px, `lg` 1024px, `xl`
1280px, `2xl` 1536px). 768px is the one structural breakpoint in the system,
because it is where navigation changes shape. Everything else is reflow.

**Two responsive floors**, following
[PRODUCT.md](PRODUCT.md#operating-context):

- Learner surfaces are designed at 360px first, on a mid-range phone on
  intermittent data. Content must be readable and navigable before video and
  images resolve. Reserve space for media so nothing shifts when it lands.
- Faculty and administrator surfaces are designed at 1280px first, with dense
  tables and authoring tools. They must still reflow, remain keyboard operable,
  and survive 200% zoom, but the phone is not their design floor.

**Rhythm:** spacing varies by role rather than repeating one value. Cards use
1.5rem of internal padding, form rows 1rem, list rows 0.75rem, marketing
sections 4rem and above. Uniform padding across a whole page is a smell.

**Z-index scale**, documented in `app/globals.css` and binding: 0 page content,
10 in-page sticky elements, 30 app header, 50 overlays (Sheet, Dialog,
Dropdown), 100 toasts and confetti. No other values.

### Named Rules

**The Sidebar Is Structure Rule.** The desktop sidebar is not a component that
can be conditionally styled away. Anything that would hide it at 768px and
above is a defect.

**The Reserve The Space Rule.** Video, images, and charts declare their
dimensions before they load. On the target device the skeleton is what most
learners see first, so it must be the right shape.

## Elevation & Depth

Depth is a response to intent, not a property of a surface. Surfaces are flat
at rest, separated by hairline borders and by the two grounds. Shadow appears
only when something is hovered, focused, dragged, or genuinely floating above
the page. This keeps Operate surfaces quiet and keeps rendering cheap on the
low-end phones that are the learner floor.

### Shadow Vocabulary

- **Soft** (`shadow-soft`): a diffuse teal-tinted ambient shadow for resting
  cards on the marketing site, where a little material is wanted.
- **Lift** (`shadow-lift`): the deeper teal-tinted shadow for hover and drag
  states, paired with the `.hover-lift` translate.
- **shadcn `shadow-sm`**: the hairline shadow carried by the base `Card`
  primitive. Acceptable at rest; anything heavier is not.

### Named Rules

**The Flat At Rest Rule.** If an element is not hovered, focused, dragged, or
overlaying the page, it has no shadow. Depth earned by interaction reads as
responsiveness; depth applied by default reads as decoration.

**The One Layer Rule.** Nothing that already sits on a raised surface may raise
itself again. Nested cards are always a structure error.

## Shapes

Corners are softened rather than round: 0.625rem (`--radius`) for cards, panels,
and dialogs, 0.5rem for buttons and inputs, 0.375rem for chips and small
controls, and a full pill only for avatars, status dots, and count badges. The
scale is derived, so changing `--radius` moves the whole system together.

Borders are always hairlines in the Hairline neutral, one pixel, on all four
sides. Form language is rectangular and calm; there are no angled cuts, no
clipped corners, and no decorative geometry. Illustration and photography sit
inside the same radius as the surface that holds them.

### Named Rules

**The No Side Stripe Rule.** A coloured left or right border thicker than one
pixel is banned everywhere: cards, list items, callouts, alerts, and Quiz
feedback. Use a tinted background, a leading icon, or a full border instead.

**The Four Sides Rule.** A border is on all four sides or it is not a border.
Partial borders are a divider, and dividers belong between rows, not around
things.

## Components

The whole library is shadcn/ui over Radix primitives in `components/ui/`, with
the app shell in `components/shell/` and the brand mark in `components/brand/`.
Every component below is precise and unhurried in its geometry, and warm in its
response: calm 150 to 250ms colour transitions, a small honest lift on hover
where lifting makes sense, and a focus ring nobody can miss.

### Buttons

- **Shape:** softened corners (0.5rem), 2.5rem tall at default size, 2.25rem
  small, 2.75rem large, and a 2.5rem square icon variant.
- **Primary** (`default`): Atlantic Teal ground, white label, used once per
  screen for the main action.
- **Secondary:** Morning Ice ground, Ink label, for the supporting action
  beside a primary.
- **Outline:** Paper ground with a hairline border, for actions that are
  neither primary nor destructive.
- **Ghost:** transparent until hovered, for toolbar and row-level actions.
- **Link:** Atlantic Teal text with an offset underline on hover, for
  navigation that must not look like a control.
- **Destructive** and **Success:** Refuse and Affirm grounds, reserved for
  irreversible actions and confirmed positive outcomes respectively.
- **Hover / Focus:** background shifts to 90% opacity of its resting colour;
  focus-visible paints a two-pixel Atlantic Teal ring offset by two pixels
  against the page background. The ring is never suppressed.
- **Disabled:** pointer events off and 50% opacity, always paired with text
  that says why.

### Cards and Containers

- **Corner style:** 0.625rem.
- **Background:** Card White on Paper; on Harbour Deep sections a card is a
  translucent lightening of the ground, not a white block.
- **Border:** one-pixel Hairline.
- **Shadow:** `shadow-sm` at rest at most; `shadow-lift` on hover only where
  the whole card is a link.
- **Internal padding:** 1.5rem, with 0.375rem between a title and its
  description.
- Cards are for things a learner can act on as a unit. Repeating identical
  icon-heading-text cards in a grid is a layout failure; prefer a list, a
  table, or a single well-structured region.

### Inputs and Fields

- **Style:** 2.5rem tall, hairline border, Paper ground, 0.5rem corners,
  0.875rem label-weight text.
- **Focus:** the same two-pixel offset Atlantic Teal ring as buttons, so focus
  looks identical everywhere.
- **Error:** Refuse border plus a message bound to the field by
  `aria-describedby`. Colour alone never signals an error.
- **Disabled:** not-allowed cursor at 50% opacity.
- Every input has a visible label. Placeholder text is never the label.

### Navigation

- **Desktop sidebar:** Harbour Deep ground, Morning Ice labels, muted teal for
  inactive items. The active item takes a lighter Harbour Deep fill and a
  Harmattan Gold marker, the one navigational use of gold. Collapsible to a
  rail; the collapsed state must keep accessible names.
- **Header:** 4rem tall, Paper ground with a hairline underline, carrying the
  page title, search, theme toggle, and the Clerk user button.
- **Mobile:** below 768px the sidebar becomes a Sheet from the left, opened
  from the header. Focus moves into the sheet on open and returns to the
  trigger on close.
- **Marketing nav:** transparent over the hero, gaining a Paper ground and
  hairline on scroll.

### Progress and Achievement

- **Progress bars and donuts:** Atlantic Teal for completed, Shallow Ice for
  remaining, Ink Muted text for the value. The numeric value is always present
  as text next to the graphic.
- **Badges and Certificates:** the only Harmattan Gold surfaces. A locked or
  unearned Badge is rendered in Morning Ice with a lock icon and text, never a
  faded gold.
- **Learning Streak:** states a fact ("4 day streak"). It never warns, counts
  down, or implies loss.

### Quiz

- **Question:** one question per view, Title-size, with the option list as
  labelled radio or checkbox controls at full row width and a minimum target of
  44 by 44 pixels.
- **Selected:** Morning Ice fill plus a hairline in Atlantic Teal.
- **Correct / Incorrect after submission:** Affirm and Refuse tints, each with
  an icon and the words "Correct" or "Incorrect". Never colour alone.
- **Timer:** Ink Muted until the final fifth of the allowance, then Caution.
  It never flashes, pulses, or animates the learner into hurrying.

### Named Rules

**The Same Focus Everywhere Rule.** Every focusable element in the product uses
the identical two-pixel offset Atlantic Teal ring. Focus styling is never
removed, never restyled per component, and never replaced by a colour change
alone.

**The Modal Is Last Rule.** Reach for inline disclosure, a dedicated route, or
a side sheet before a dialog. Dialogs are for destructive confirmation and for
genuinely blocking decisions.

## Do's and Don'ts

### Do

- **Do** derive every colour, radius, and shadow from the tokens in
  `app/globals.css` and `tailwind.config.ts`. A raw hex in a component is a
  defect.
- **Do** keep reading measure between 65 and 75 characters at every breakpoint.
- **Do** pair every colour signal with text or an icon.
- **Do** design the learner surfaces at 360px before the desktop layout.
- **Do** reserve layout space for video, images, and charts before they load.
- **Do** give every empty state a Headline that names what is missing and one
  primary action that fixes it.
- **Do** write errors that say what happened and what the person can do next.
- **Do** respect `prefers-reduced-motion`: fade only, and never make motion
  load bearing.
- **Do** keep the desktop sidebar rendered at 768px and above, unconditionally.

### Don't

- **Don't** use Harmattan Gold for anything a learner has not earned.
- **Don't** use a coloured left or right border as an accent, anywhere.
- **Don't** use gradient text (`background-clip: text`) anywhere in the product.
- **Don't** nest a card inside a card, or raise a raised surface again.
- **Don't** repeat identical icon-heading-text cards in a grid.
- **Don't** use `#000`, `#fff`, or an untinted grey outside the Card White
  reading surface.
- **Don't** introduce a third ground beside Harbour Deep and Paper.
- **Don't** animate layout properties, or use bounce and elastic easing.
- **Don't** use motion, colour, or copy to create urgency, streak anxiety, or
  fear of loss.
- **Don't** show ratings, enrolment counts, countdowns, or any marketplace
  social proof.
- **Don't** put a Fraunces label on a control.

## Accessibility

Baseline: **WCAG 2.2 AA**, binding on every surface and verified with the
feature that introduces it, not in a later pass. See
[PRODUCT.md](PRODUCT.md#accessibility--inclusion).

**Accessible state vocabulary.** Every interactive element must express these
states, and the same state must look and sound the same everywhere:

| State | Visual | Assistive technology |
| --- | --- | --- |
| Rest | Token colours, flat, hairline border | Accessible name from visible label |
| Hover | Background at 90% of resting colour; lift only where the element is a link | No announcement |
| Focus | Two-pixel Atlantic Teal ring, two-pixel offset, never suppressed | Focus order follows reading order |
| Active / pressed | Atlantic Teal Deep, no size change | `aria-pressed` where it is a toggle |
| Selected | Morning Ice fill plus Atlantic Teal hairline | `aria-selected` or checked state |
| Disabled | 50% opacity, pointer events off | `disabled`, plus text saying why |
| Loading | Skeleton in the final shape, or an inline spinner with a label | `aria-busy`, polite live region |
| Empty | Headline naming what is missing, plus one action | Heading in the document outline |
| Error | Refuse border plus message text and icon | `aria-describedby` on the field, assertive live region |
| Success | Affirm tint plus message text and icon | Polite live region |
| Locked | Morning Ice fill, lock icon, text naming the unlock condition | Text, never colour or icon alone |

**Non-negotiables.** Minimum target size 44 by 44 pixels on learner surfaces.
Contrast of 4.5:1 for body text and 3:1 for large text and meaningful
non-text: Ink Muted is never used on anything below body size. All content and
functionality available at 200% zoom without horizontal scrolling. Every
surface fully keyboard operable, with focus moved deliberately into and out of
sheets and dialogs. Video carries captions. Charts have a text or table
alternative. No content flashes more than three times per second.

## Content Patterns

- **Titles** name the thing, not the screen: "Ethics in Global Health", not
  "Course Detail Page".
- **Buttons** are verb-first and specific: "Start pre-test", not "Submit" or
  "Continue".
- **Empty states** are three parts: a Headline naming what is missing, one
  sentence saying why it might be empty, one primary action.
- **Errors** name what happened, in the learner's terms, then what to do next.
  No error blames the person, exposes an internal code as its headline, or says
  "something went wrong" alone.
- **Loading** never shows a bare spinner where a skeleton in the final shape is
  possible.
- **Destructive confirmations** name the object and the consequence: "Delete
  the Module 'Positionality'? Learner progress in it will be removed."
- **Numbers** carry their unit and never appear without a label. A statistic
  the product does not actually have is omitted, never estimated.
- **Achievement copy** states the fact and stops. It does not congratulate at
  length, and it never implies what will be lost.

## Exceptions and Approval

This document is binding. An intentional exception is allowed only through this
process, and only in this order:

1. **Try the system first.** Most exception requests are structure problems.
   Re-check Layout, Shapes, and Components before proposing one.
2. **Record it in the pull request.** State the rule being broken, the surface
   and file, why the system cannot express the need, and whether the exception
   is one-off or wants to become a token.
3. **Get an approver.** A visual or interaction exception needs
   Prince Agyei Tuffour (@nanaagyei), recorded by name and date in the PR.
   Nobody approves their own exception.
4. **Never waive these.** The accessibility baseline, the focus ring, the
   colour-is-never-alone rule, the reading measure, and the target size are not
   exceptable. A request to weaken one of them is refused, and the underlying
   need is solved another way.
5. **Promote or delete.** An exception used a third time is either promoted
   into this document as a token or rule, or removed. Exceptions do not
   accumulate silently.

Approved exceptions are listed in the pull request that introduces them and
summarised here when they change a rule.
