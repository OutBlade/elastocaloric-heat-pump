# EC-Lab — User Guide

Daily-use desktop research tool for elastocaloric polymer film experiments.
Built with Electron, same auto-update pattern as Neon Pulse.

---

## Installation

### Windows

1. Download `ECLabSetup-x.x.x.exe` from the [latest release](https://github.com/OutBlade/elastocaloric-heat-pump/releases/latest)
2. Double-click the installer

**Windows SmartScreen warning:** Because the installer is not yet commercially code-signed, Windows may show "Windows protected your PC." This is a standard warning for new unsigned software — it does not mean the file is harmful.

To proceed: click **More info** → **Run anyway**. The app installs to your user folder and does not require administrator rights.

The warning will appear less frequently as more people download and run the installer (SmartScreen tracks reputation by download count).

---

## First launch — no hardware needed

EC-Lab works fully without any physical hardware. Use **Demo Mode** to explore every feature before connecting the Arduino.

**To start Demo Mode:**
1. Open the Monitor tab (selected by default)
2. Click the **▶ Demo** button in the top-right of the toolbar
3. The app begins simulating a Natural Rubber film cycling at 0.4 Hz with ΔT_ad ≈ 2.5 K
4. All four live charts update, COP gauge turns green, cycle counter increments
5. Click **⏺ Record** to record the simulated session to a CSV file
6. Click **⏹ Stop Demo** when done

The recorded CSV is fully compatible with the **Analysis → Demonstrator Log** section — you can immediately load it and see per-cycle COP and second-law efficiency computed from the simulated data.

---

## Tab guide

### Monitor

Connect to the Arduino controller over USB and see all sensor data live.

**With hardware:**
1. Plug in the Arduino via USB
2. Click **↺ Refresh** to scan for available serial ports
3. Select the correct COM port from the dropdown (Windows shows `COM3`, `COM4`, etc.)
4. Leave baud rate at **115200** (matches the firmware default)
5. Click **Connect** — the status pill in the top bar turns green
6. Click **⏺ Record** to start saving data to CSV; click **⏹ Stop** to save the file

**Reading the display:**
- **T Cold / T Hot** — temperatures from the two MAX31855 thermocouple breakouts; the ΔT indicator below shows whether the cold side is dropping (blue ▼) or rising (red ▲) relative to the previous sample
- **Force** — load cell reading via HX711 amplifier
- **Displacement** — stepper motor position in mm
- **COP gauge** — rolling coefficient of performance. Green = COP above 1 (cooling is thermodynamically useful). Red = below 1. The Carnot COP and second-law efficiency are shown below the bar
- **ΔT span** — current hot–cold temperature difference
- **Cycles** — number of complete loading/unloading cycles detected in this session

**Without hardware:** click **▶ Demo** — all features work identically with simulated data.

---

### Analysis

All analysis runs entirely in the app — no Python, no terminal.

**Loading data:** either click **Open file…** to browse for a CSV, or paste raw CSV text directly into the grey text box below the button, then click the button. The paste-box approach is useful when copying data from a spreadsheet or another tool.

#### DSC Analysis

Expects columns: `temperature_C`, `heat_flow_mW_mg`

After loading, the app:
- Smooths the signal with a moving average
- Finds the dominant endothermic or exothermic peak
- Subtracts a linear baseline and integrates to give ΔH (latent heat in J g⁻¹)
- Computes ΔS = ΔH / T* at the midpoint temperature
- **Auto-fills the Material Calculator** with the measured ΔH and T* values

#### Stress–Strain Analysis

Expects columns: `strain_pct`, `stress_MPa`

Outputs: initial Young's modulus (from the linear 0–5 % region), maximum stress and strain, and the mechanical hysteresis area in MJ m⁻³. Lower hysteresis means less work is dissipated per cycle and higher COP is achievable.

#### Demonstrator Log Analysis

Expects columns: `timestamp_s`, `T_cold_C`, `T_hot_C`, `force_N`, `displacement_mm`, `power_W`

This is exactly the format saved by the Record button in the Monitor tab. Works with both real hardware sessions and Demo mode recordings.

Enter the film mass in grams before loading. The app detects individual cycles from the force signal, computes mechanical work (∫F dδ) and cold-side heat transfer per cycle, and plots:
- COP per cycle — watch for drift indicating fatigue
- Temperature span per cycle
- Second-law efficiency (η = COP_device / COP_Carnot) — tells you how close you are to the theoretical limit

#### Material Calculator — no hardware required

This section lets you predict theoretical performance from material properties alone. Use it to:
- Rank candidate polymers from literature before making any samples
- Predict what ΔT_ad and COP to expect from a new material
- Understand how much a 10 % improvement in ΔH changes the COP
- Compare your measured values against literature after running DSC

**Presets available:** Natural Rubber, PVDF, Silicone (PDMS), TiNiCuCo SMA (Xu 2024), NiTi wire

**Inputs:**
| Field | Source | Typical values |
|-------|--------|----------------|
| ΔH (J g⁻¹) | DSC peak integration | NR: 3, PVDF: 1.2, SMA: 22 |
| T* (K) | DSC peak midpoint | 295–330 K |
| ρ (g cm⁻³) | datasheet | NR: 0.92, PVDF: 1.78 |
| c_p (J g⁻¹ K⁻¹) | datasheet / literature | NR: 1.88, PVDF: 1.30 |
| ε_max (%) | tensile test | NR: 300, PVDF: 10 |
| Cost (€ m⁻²) | supplier quote | NR: ~1, PVDF: ~8 |

**Outputs:**
- **ΔT_ad** = ΔH / c_p — adiabatic temperature change
- **COP at 5 K span** — Carnot-based estimate for a 5 K hot–cold gap
- **ΔS** — entropy change per unit mass per degree
- **FOM** = ΔT_ad × COP / cost — figure of merit for cost-effective cooling
- **vs SMA comparison** — ratio against the TiNiCuCo reference from Xu et al. 2024

---

### Samples

A persistent database of all polymer film samples. Data is stored locally in your app data folder and survives restarts and updates.

**Adding a sample:**
1. Click **+ New Sample**
2. Fill in material type, your lab ID (e.g. `NR-001`), dimensions, mass, and notes
3. Click **Save Sample** — the sample appears as a card

**Logging a run:**
After finishing a cycling session, click **+ Log run** on the sample card. Enter the number of cycles run, optional COP and ΔT span values, and notes. The fatigue health bar updates automatically.

**Fatigue health bar:**
The bar tracks accumulated cycles against an estimated fatigue limit. Colors:
- Green — below 50 % of estimated life
- Amber — 50–80 %, plan to prepare a replacement film
- Red — above 80 %, inspect the film carefully before each run

---

### Compare

Selects any combination of your logged samples and plots them side-by-side against the TiNiCuCo SMA reference baseline. The **Cost / (ΔT × COP)** column in the table shows the figure of merit — lower is better, meaning the material delivers more cooling per euro.

---

### Reports

Generates a self-contained HTML report for a selected sample. The report includes sample specifications, performance summary, and full experiment log in a clean format suitable for lab records, supervisor meetings, or attaching to emails.

Click **Generate & Export HTML** to save and immediately open the file in your browser, where it can also be printed to PDF.

---

## Auto-update

The app checks for updates 5 seconds after launch and every 15 minutes while running. Updates download silently in the background. A banner appears in the top bar when an update is ready. The update installs automatically when you quit the app, or you can click the banner to install immediately.

---

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

To release a new version, bump the version in `app/package.json`, then:

```bash
git tag app-v1.x.x
git push origin app-v1.x.x
```

GitHub Actions builds and publishes the installer automatically.
