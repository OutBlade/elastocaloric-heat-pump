# Setup Guide

## Hardware Requirements

- Polymer film sample (e.g. natural rubber, PVDF, or silicone sheet)
- Linear actuator or servo motor for controlled mechanical loading
- Thermocouples or IR thermometer for surface temperature measurement
- Microcontroller (Arduino or similar) for actuation timing
- Heat exchanger blocks (copper or aluminum) for hot and cold side
- Insulating frame to minimize parasitic heat transfer

## Software Requirements

- Python 3.10+
- Jupyter Notebook
- numpy, pandas, matplotlib, scipy

Install Python dependencies:

```bash
pip install numpy pandas matplotlib scipy jupyter
```

## Initial Assembly

1. Clamp the polymer film between the two heat exchanger blocks.
2. Connect the linear actuator to apply and release stress on the film.
3. Attach thermocouples to the hot-side and cold-side heat exchangers.
4. Connect the microcontroller to the actuator driver and thermocouple reader.
5. Flash the firmware from `firmware/` onto the microcontroller.
6. Run the baseline characterization notebook in `experiments/01_baseline/`.

## Safety Notes

- Do not exceed the film's rated strain — check material datasheet for limits.
- Ensure the actuator has a hard stop to prevent film rupture.
- All electrical connections should be insulated before powering the system.
