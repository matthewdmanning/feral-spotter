# FeralSpotter

![Status](https://img.shields.io/badge/status-alpha-orange?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Android%20%7C%20iOS-brightgreen?style=flat-square&logo=android)
![Expo](https://img.shields.io/badge/Expo-SDK%2056-000020?style=flat-square&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![License](https://img.shields.io/github/license/matthewdmanning/feral-spotter?style=flat-square)

A React Native mobile app for reporting and tracking feral animal sightings. Users capture photos, annotate them, and submit georeferenced observations that feed into downstream computer vision and ecological modeling pipelines.

> **Status:** Active development — Android build in progress. Core features implemented; dependency stabilization underway.

---

## Features

- **Observation capture** — photo submission with gesture-based annotation tools
- **Geolocation** — automatic GPS tagging of each sighting
- **Authentication** — Firebase-backed user auth
- **Offline-first** — local state and caching layer before cloud sync
- **Structured submissions** — validated observation forms with time/location metadata

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 56 (New Architecture) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| State | Zustand |
| Styling | react-native-unistyles v3 |
| Auth | Firebase |
| Image | expo-image |
| Animation | react-native-reanimated v4 |
| Analytics | PostHog |

## Getting Started

### Prerequisites

- Node.js 18+
- Android Studio (for Android emulator) or a physical Android device
- Expo CLI (via npx — no global install needed)

### Setup

```bash
npm install
expo prebuild --clean   # required — this project uses native modules
```

### Run

```bash
npm run android    # Android emulator or device
npm run ios        # iOS simulator (Mac only)
```

### Other Commands

```bash
npm run lint       # ESLint via expo lint
npm run typecheck  # tsc --noEmit
npm test           # Jest
```

## Project Structure

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the system context, directory layout, and current milestone status.
