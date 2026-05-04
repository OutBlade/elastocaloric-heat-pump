# EC-Lab Desktop App

Daily-use research tool for elastocaloric polymer film experiments.
Built with Electron — same stack as [Neon Pulse](https://github.com/OutBlade/neon-pulse).

## Features

**Live Monitor** — Connect to the Arduino demonstrator controller via USB serial. Live-plots T cold, T hot, force, and displacement at 10 Hz. Computes rolling COP in real time with a color-coded gauge (green = COP > 1). One-click record to CSV.

**Analysis** — Load DSC, tensile, or demonstrator log CSV files. Peak detection, ΔH/ΔS integration, stress–strain modulus, hysteresis area, per-cycle COP and second-law efficiency — all computed in-app, no Python required.

**Samples** — Database of all polymer film samples with dimensions, mass, accumulated cycle count, and fatigue health bar. Add experiment results with cycle counts, COP, and ΔT span.

**Compare** — Side-by-side bar charts of ΔT_ad, COP, material cost, and cycle count against the TiNiCuCo SMA reference baseline from Xu et al. 2024.

**Reports** — One-click HTML report generator per sample, suitable for lab records or sharing with collaborators.

## Development

```bash
cd app
npm install
npm start
```

## Build installer

```bash
npm run dist:win
```

Output: `dist/ECLabSetup-x.y.z.exe`

## Auto-update

Releases are published automatically when a tag matching `app-v*` is pushed.
The app checks for updates 5 s after launch and every 15 minutes.
Updates download silently in the background and install on next quit.

To release a new version:

```bash
# bump version in app/package.json, then:
git tag app-v1.0.1
git push origin app-v1.0.1
```

GitHub Actions builds the installer and publishes it as a GitHub Release.
`electron-updater` reads `latest.yml` from the release assets.

## Hardware

Designed for the Arduino controller in `firmware/controller.ino`.
Default serial: 115200 baud, format `timestamp_ms,T_cold_C,T_hot_C,force_N,displacement_mm,power_W`.
