# Liquid Glass UI

A Next.js playground based on the supplied liquid-glass reference, with a neutral
charcoal background and local image / custom gradient controls.

## Run locally

Requires Node.js 20.9 or newer. Node.js 24 is recommended for this checkout.

```powershell
npm.cmd ci
npm.cmd run dev
```

Open <http://127.0.0.1:3000>. If the port is busy, Next.js prints the selected port.
On macOS/Linux, use `npm` in place of `npm.cmd`.

```powershell
npm.cmd run type-check
npm.cmd run lint
npm.cmd run build
npm.cmd start
```

The development and production servers bind to loopback by default.

## Controls

- **Image** opens a local image picker. Images stay in the browser and are not uploaded.
- **Gradient** opens six presets, three color pickers, and a direction slider.
  Changes preview immediately. Done, Escape, or clicking outside closes the editor.
- **Focus** toggles a dimmed background and heading.
- **Camera** also opens the image picker.
- **Overlapping squares** toggle clear and frosted glass.

Image and gradient selections last for the current page session. Reloading restores
the Graphite background. Image backgrounds use centered `cover` sizing.

See [the complete handover](Readme%20files/README.md) for architecture, verification,
limits, and the manual browser checklist.
