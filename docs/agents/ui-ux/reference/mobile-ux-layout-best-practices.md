# Mobile UX and Layout Best Practices for FeralSpotter

Date: 2026-10-28

## Purpose

This document lists layout and UX rules for FeralSpotter. FeralSpotter is a React Native (Expo) camera app for Android. Builds are local. EAS is not used.

Each bullet cites a page that was retrieved and read during research. Text is paraphrased. Some bullets say "Applies to RN". This means the source describes native Android or the web, and the rule is mapped to React Native by the author of this report.

Known gap: the Material Design 3 pages (m3.material.io) need JavaScript. They could not be read. No M3 claim is made here. Android design pages on developer.android.com are used instead.

---

## 1. UI aesthetics

- Keep text contrast at 4.5:1 or higher for normal text. Large text needs 3:1. Do not round the ratio. Source: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Android guidance gives the same limits: 4.5:1 for text below 18sp (or bold below 14sp), 3:1 for other text. Source: https://developer.android.com/guide/topics/ui/accessibility/apps
- Keep icons, input borders, and focus outlines at 3:1 against nearby colors. Disabled controls are exempt. Source: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Do not use color alone to show state (for example a red or green marker). Add text, an icon, or a shape. Source: https://developer.android.com/guide/topics/ui/accessibility/principles
- Group related content and its actions (for example in a card). Keep few actions on one view. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics
- Put main navigation and key actions where the thumb can reach. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics
- Keep alignment and spacing the same for similar elements. Uneven spacing looks careless. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics
- Support dark mode. Set `userInterfaceStyle` in the Expo app config. Read the theme with `useColorScheme`. If the value is missing, the app uses light. Source: https://docs.expo.dev/develop/user-interface/color-themes/
- In Expo development builds on Android, `expo-system-ui` must be installed. Without it, `userInterfaceStyle` is ignored. Source: https://docs.expo.dev/develop/user-interface/color-themes/
- Do not hardcode light-theme colors. Use theme-based colors. Test every screen in light and dark. Source: https://developer.android.com/develop/ui/views/theming/darktheme
- Dark theme saves power on some screens and helps users with low vision or light sensitivity. Source: https://developer.android.com/develop/ui/views/theming/darktheme
- Load custom fonts with the `expo-font` config plugin (needs a development build) or `useFonts`. Keep the splash screen visible until fonts load. Without `fontFamily`, Android uses Roboto. Source: https://docs.expo.dev/develop/user-interface/fonts/
- Check the contrast of status bar icons against the content behind them. Source: https://developer.android.com/design/ui/mobile/guides/foundations/system-bars

## 2. Spacing

- Use an 8dp grid for layout, components, and spacing. Use a 4dp grid for small items such as icons and type. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/grids-and-units
- Use dp for sizes and spacing, and sp for font sizes. Do not use raw pixels. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/grids-and-units
- React Native layout values are dp. React Native rounds native frames to the pixel grid. Use `PixelRatio.roundToNearestPixel()` if you round values yourself. Source: https://reactnative.dev/docs/pixelratio
- Make each touch target at least 48dp by 48dp. Keep targets at least 8dp apart. Source: https://support.google.com/accessibility/android/answer/7101858
- The tap area can be larger than the visible icon. Add padding. Source: https://support.google.com/accessibility/android/answer/7101858
- In RN, use `hitSlop` on `Pressable` to enlarge the tap area. The area cannot go past the parent bounds. Source: https://reactnative.dev/docs/pressable
- WCAG 2.2 sets a lower floor: 24 by 24 CSS pixels, with a spacing exception. Use 48dp as the app target. Source: https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- Keep content away from display cutouts, system bars, and the keyboard. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics
- Use `react-native-safe-area-context`. Wrap the app in `SafeAreaProvider`. Use `SafeAreaView` or `useSafeAreaInsets` for padding. Source: https://docs.expo.dev/develop/user-interface/safe-areas/
- Android has three inset types: system bars, display cutout, and system gestures. Apply system bar insets as padding or margin on tappable views. Source: https://developer.android.com/develop/ui/views/layout/edge-to-edge
- Keep touch targets out of the gesture bar area. Source: https://developer.android.com/design/ui/mobile/guides/foundations/system-bars
- The shutter button and bottom controls need the bottom inset. Applies to RN.

## 3. Overflow

- Use `numberOfLines` to cap lines. It adds an ellipsis. Source: https://reactnative.dev/docs/text
- `ellipsizeMode` works only with `numberOfLines`. Default is `tail`. On Android, with more than one line, only `tail` works well. Source: https://reactnative.dev/docs/text
- `adjustsFontSizeToFit` shrinks text. Pair it with `minimumFontScale`. Use it only for short labels, not body text. Source: https://reactnative.dev/docs/text
- `flexShrink` lets children shrink when they overflow the main axis. Its default is 0 (no shrink). Set it on text rows. Source: https://reactnative.dev/docs/layout-props
- `overflow: 'hidden'` clips content outside the view bounds. Use it on purpose, for example for rounded image crops. Source: https://reactnative.dev/docs/layout-props
- Treat clipped, cut, or hidden text or controls at large text size as a failure. Source: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- Use a minimum height, not a fixed height, for rows that contain text. Source: https://developer.android.com/develop/ui/compose/accessibility/scalable-content (Compose page; the rule is mapped to RN `minHeight`)
- When the keyboard is open, move the focused input up or attach it to the keyboard. Do not leave inputs hidden. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics
- `KeyboardAvoidingView` takes `behavior` of `height`, `position`, or `padding`. Android and iOS differ. Set it and test on Android. Source: https://reactnative.dev/docs/keyboardavoidingview
- Expo suggests `padding` on iOS and no behavior on Android as a start. Test other values. Source: https://docs.expo.dev/guides/keyboard-handling/
- If a tab bar jumps above the keyboard, set `android.softwareKeyboardLayoutMode` to `pan`. Or hide the tab bar with `tabBarHideOnKeyboard`. Source: https://docs.expo.dev/guides/keyboard-handling/
- For long forms (notes, location, colony data), use `react-native-keyboard-controller`. It needs a development build. Source: https://docs.expo.dev/guides/keyboard-handling/
- Set `keyboardShouldPersistTaps="handled"` on a `ScrollView` that holds inputs and buttons. The default `never` closes the keyboard on the first tap. Source: https://reactnative.dev/docs/scrollview
- Give a limit to content width on wide windows. Do not stretch inputs or buttons edge to edge. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout
- Show an empty state with `ListEmptyComponent`. Source: https://reactnative.dev/docs/flatlist

## 4. Text enlargement

- `allowFontScaling` defaults to true. Text follows the system Text Size setting. Leave it on. Source: https://reactnative.dev/docs/text
- `maxFontSizeMultiplier` caps the scale. A value of 1 or more sets a cap. A value of 0 means no cap. Use a cap only for fixed UI such as tab labels or camera overlays. Source: https://reactnative.dev/docs/text
- `useWindowDimensions` returns `fontScale` and updates when it changes. Source: https://reactnative.dev/docs/usewindowdimensions
- `PixelRatio.getFontScale()` reads the system font scale (Android: Settings, Display, Font size). Source: https://reactnative.dev/docs/pixelratio
- WCAG 1.4.4: users must be able to enlarge text to 200% with no loss of content or function. Source: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- WCAG 1.4.10: vertical content must work at a width equal to 320 CSS pixels without two-way scrolling. Maps, diagrams, video, and games are exempt. Source: https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- Android font scaling is non-linear. A scale factor of 2.0 does not make text exactly twice as big. Test on a real device with the largest setting. Source: https://developer.android.com/develop/ui/compose/accessibility/scalable-content
- Test with both font scale and display size settings. Check for overlap and hidden content. Source: https://developer.android.com/develop/ui/compose/accessibility/scalable-content
- Set `lineHeight` with the font size so wrapped lines do not collide. Source: https://developer.android.com/develop/ui/compose/accessibility/scalable-content (Compose page; mapped to RN)
- Let text rows wrap and grow. Do not set a fixed height on a text container. Source: https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- Stack buttons vertically when a row does not fit at large scale. Applies to RN. Basis: reflow rule at https://www.w3.org/WAI/WCAG22/Understanding/reflow.html

## 5. Aspect ratios

- `aspectRatio` sets the unset side from the set side. It respects `min` and `max` width and height. Source: https://reactnative.dev/docs/layout-props
- Remote images need explicit `width` and `height`. React Native cannot know the size before load. Local images infer size. Source: https://reactnative.dev/docs/image
- `cover` fills the box and may crop. `contain` shows the whole image and may leave empty space. Source: https://reactnative.dev/docs/image
- `expo-image` has `contentFit` with `cover`, `contain`, `fill`, `none`, `scale-down`. Source: https://docs.expo.dev/versions/latest/sdk/image/
- With `expo-image` placeholders, set `placeholderContentFit` to match `contentFit`. This avoids flicker. Source: https://docs.expo.dev/versions/latest/sdk/image/
- Set `recyclingKey` on `expo-image` items inside FlashList. Source: https://docs.expo.dev/versions/latest/sdk/image/
- Use `contain` for a photo detail view, so the whole cat is visible. Use `cover` for fixed-ratio grid thumbnails. Applies to RN. Basis: image resize modes at https://reactnative.dev/docs/image
- Camera preview, fit mode: scale by the smaller ratio. The whole frame shows and bars appear. Fill mode: scale by the larger ratio. The frame is cropped. Source: https://developer.android.com/media/camera/camerax/preview (native CameraX; the same math applies to any preview)
- In `expo-camera`, `ratio` (Android only) accepts `4:3`, `16:9`, `1:1`. Setting it changes the preview from fill to fit. Source: https://docs.expo.dev/versions/latest/sdk/camera/
- An unsupported ratio falls back to the closest supported one. Source: https://docs.expo.dev/versions/latest/sdk/camera/
- `pictureSize` overrides `ratio`. Get valid sizes from `getAvailablePictureSizesAsync()`. The list differs between Android devices. Source: https://docs.expo.dev/versions/latest/sdk/camera/
- Make the preview ratio match the saved photo ratio. Then the user sees what is saved. Applies to RN. Basis: ratio and pictureSize behavior at https://docs.expo.dev/versions/latest/sdk/camera/
- Photos are rotated to match device orientation unless `skipProcessing` is on. Source: https://docs.expo.dev/versions/latest/sdk/camera/
- Size classes use window width: compact below 600dp, medium 600 to below 840dp, expanded 840dp and up (large and extra-large exist above). Height: compact below 480dp, medium 480 to below 900dp. Source: https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- Use the window size, not the device type. The class can change at run time (rotation, split screen, folding). Source: https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- A landscape phone can have medium width and compact height. Do not use two panes there. Source: https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- In RN, read `useWindowDimensions` and derive a size class. It updates on rotation and window resize. Source: https://reactnative.dev/docs/usewindowdimensions
- Portrait-only locking causes letterboxing in multi-window, desktop windowing, and on foldables. Source: https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout
- Foldables: window size changes with fold, rotation, and multi-window. Tabletop posture means half-open with a horizontal hinge: put the preview on the upper part and controls on the lower part. Source: https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware
- For large screens, three proven layouts exist: list-detail, feed, supporting pane. A cat list with a detail view maps to list-detail. A camera with a tool panel maps to supporting pane. Source: https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts

## 6. Scrolling

- `ScrollView` renders all children at once. Use `FlatList` for long lists. Source: https://reactnative.dev/docs/scrollview
- `FlatList` renders items near the screen and removes far ones. Source: https://reactnative.dev/docs/scrollview
- Give each item a stable key with `keyExtractor`. Source: https://reactnative.dev/docs/optimizing-flatlist-configuration
- Use `getItemLayout` when all items have the same size. Source: https://reactnative.dev/docs/optimizing-flatlist-configuration
- Wrap item components in `React.memo()`. Source: https://reactnative.dev/docs/optimizing-flatlist-configuration
- `windowSize` default is 21. A larger value reduces blank areas and uses more memory. Source: https://reactnative.dev/docs/optimizing-flatlist-configuration
- `removeClippedSubviews` is on by default on Android. It can cause missing content in some cases. Source: https://reactnative.dev/docs/optimizing-flatlist-configuration
- `initialNumToRender` default is 10. Set it to fill the screen, not much more. Source: https://reactnative.dev/docs/flatlist
- For large or slow lists, React Native docs suggest FlashList or Legend List. FlashList recycles item components. Sources: https://reactnative.dev/docs/performance and https://docs.expo.dev/versions/latest/sdk/flash-list/
- Pull to refresh: set `onRefresh` and `refreshing` on `FlatList`. Set `refreshing` true while loading, then false. Source: https://reactnative.dev/docs/flatlist
- For a `ScrollView`, pass a `RefreshControl` to `refreshControl`. It works only on vertical views. Source: https://reactnative.dev/docs/scrollview
- `nestedScrollEnabled` is false by default and works on Android API 21 and up. Set it only for a scroll view inside another scroll view. Source: https://reactnative.dev/docs/scrollview
- Prefer one scroller per direction. Put extra content in `ListHeaderComponent` or `ListFooterComponent`. Basis: lazy lists are the recommended path at https://developer.android.com/develop/ui/compose/touch-input/pointer-input/scroll (the page does not state the nesting rule; the rule is the author's mapping)
- `showsVerticalScrollIndicator` defaults to true. Leave it on for long lists. Source: https://reactnative.dev/docs/scrollview
- JS thread work can drop frames. Scrolling in a `ScrollView` continues if JS is blocked. Test performance in a release build, not in dev mode. Source: https://reactnative.dev/docs/performance
- Remove `console.*` calls in production builds. Source: https://reactnative.dev/docs/performance
- Apps that target SDK 35 on Android 15 and up draw edge-to-edge. Scroll content may show behind the navigation bar. Source: https://developer.android.com/develop/ui/views/layout/edge-to-edge
- For scrolling lists, pad the content by the system bar and cutout insets. Items then scroll behind the bars but stop clear of them. Source: https://developer.android.com/develop/ui/views/layout/edge-to-edge
- In RN, apply `useSafeAreaInsets().bottom` to `contentContainerStyle` paddingBottom of the list. Applies to RN. Basis: https://docs.expo.dev/develop/user-interface/safe-areas/
- Edge-to-edge is enforced by default on Android 15 and later. Use `enableEdgeToEdge()` on older versions. Source: https://developer.android.com/design/ui/mobile/guides/foundations/system-bars

---

## Checklist for FeralSpotter

Run each item on a real Android device or emulator. Mark pass or fail.

Aesthetics

- [ ] Body text contrast is 4.5:1 or higher in light and dark theme. (WCAG 1.4.3)
- [ ] Icons and input borders are 3:1 or higher against their background. (WCAG 1.4.11)
- [ ] No state is shown by color alone (for example sighting status).
- [ ] Switching system dark mode changes every screen. No hardcoded light colors remain.
- [ ] `expo-system-ui` is installed. `userInterfaceStyle` is set in the app config.
- [ ] Status bar icons are readable over every screen header and over the camera.

Spacing

- [ ] All paddings, margins, and gaps are multiples of 4. Most are multiples of 8.
- [ ] Every tappable control is 48dp by 48dp or larger (use `hitSlop` or padding).
- [ ] Neighbor tappable controls are 8dp or more apart.
- [ ] Content never sits under the status bar, cutout, gesture bar, or 3-button bar.
- [ ] Shutter button and bottom controls clear the bottom inset on gesture and 3-button navigation.

Overflow

- [ ] A 60-character cat name does not break any row. It ends with an ellipsis or wraps.
- [ ] Long notes wrap or scroll. No text is cut without a way to read it.
- [ ] Opening the keyboard never hides the focused input on any form.
- [ ] The first tap on a button inside a form works while the keyboard is open.
- [ ] Every list has an empty state.

Text enlargement

- [ ] Set Android font size to the largest. No text is clipped, overlapped, or hidden on any screen.
- [ ] Set Android display size to the largest too. Repeat the check.
- [ ] No text container has a fixed height. Rows use `minHeight`.
- [ ] Every `maxFontSizeMultiplier` cap in the code has a written reason.
- [ ] Button rows stack when they do not fit at large font scale.
- [ ] Core flows (open camera, take photo, save sighting) work at the largest font size.

Aspect ratios

- [ ] The preview ratio equals the saved photo ratio. A test photo shows the same framing as the preview.
- [ ] The app handles a camera `ratio` that the device does not support.
- [ ] Thumbnails use `cover` with a fixed ratio. Detail view uses `contain`.
- [ ] Remote images have width and height or `aspectRatio` set. No layout jump on load.
- [ ] Rotate the device. Layout and camera preview stay correct.
- [ ] Test split-screen and a 600dp+ width window (tablet or foldable emulator). No stretched controls.
- [ ] Landscape phone (compact height) is usable. No two-pane layout there.

Scrolling

- [ ] Lists with more than a screen of items use `FlatList` or FlashList, not `ScrollView`.
- [ ] Every list item has a stable `keyExtractor` key. Item components use `React.memo`.
- [ ] Pull to refresh works and stops when loading ends.
- [ ] No list nested inside a same-direction scroller. No VirtualizedList warning in logs.
- [ ] The last list item is fully visible above the navigation bar.
- [ ] Scrolling a 200-item list in a release build shows no visible stutter.
- [ ] Production build contains no `console.*` output.

---

## Sources

React Native

- https://reactnative.dev/docs/text
- https://reactnative.dev/docs/layout-props
- https://reactnative.dev/docs/image
- https://reactnative.dev/docs/pixelratio
- https://reactnative.dev/docs/usewindowdimensions
- https://reactnative.dev/docs/keyboardavoidingview
- https://reactnative.dev/docs/pressable
- https://reactnative.dev/docs/scrollview
- https://reactnative.dev/docs/flatlist
- https://reactnative.dev/docs/optimizing-flatlist-configuration
- https://reactnative.dev/docs/performance

Expo

- https://docs.expo.dev/develop/user-interface/safe-areas/
- https://docs.expo.dev/develop/user-interface/color-themes/
- https://docs.expo.dev/develop/user-interface/fonts/
- https://docs.expo.dev/guides/keyboard-handling/
- https://docs.expo.dev/versions/latest/sdk/camera/
- https://docs.expo.dev/versions/latest/sdk/image/
- https://docs.expo.dev/versions/latest/sdk/flash-list/

Android

- https://developer.android.com/design/ui/mobile/guides/layout-and-content/grids-and-units
- https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics
- https://developer.android.com/design/ui/mobile/guides/layout-and-content/adapt-layout
- https://developer.android.com/design/ui/mobile/guides/foundations/system-bars
- https://developer.android.com/guide/topics/ui/accessibility/apps
- https://developer.android.com/guide/topics/ui/accessibility/principles
- https://support.google.com/accessibility/android/answer/7101858
- https://developer.android.com/develop/ui/compose/accessibility/scalable-content
- https://developer.android.com/develop/ui/views/theming/darktheme
- https://developer.android.com/develop/ui/views/layout/edge-to-edge
- https://developer.android.com/develop/ui/compose/layouts/adaptive/use-window-size-classes
- https://developer.android.com/develop/ui/compose/layouts/adaptive/foldables/make-your-app-fold-aware
- https://developer.android.com/develop/ui/compose/layouts/adaptive/canonical-layouts
- https://developer.android.com/media/camera/camerax/preview
- https://developer.android.com/develop/ui/compose/touch-input/pointer-input/scroll

W3C WCAG 2.2

- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
