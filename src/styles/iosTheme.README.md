# iOS interface mode

- `iOS` is an optional interface/layout mode, not a color theme.
- Interface choices: `default` and `ios`, stored in `huy-locket-interface`.
- Color themes remain unchanged and are selected independently through the existing theme list.
- Examples: `iOS + Hồng Tuyết`, `iOS + Đại Dương Xanh`, `Mặc định + Glass`.
- Phone-only Locket layout is gated by `html.theme-ios` in `mobileLocket.css`.
- Tablet and desktop keep the wide existing layout.
- iOS glass/chrome inherits `--color-*` variables from the selected theme; there is no separate iOS color picker.
- Light / dark / system color mode and Lite performance mode continue to work independently.
- Users who briefly selected the old `ios` color theme are migrated to `iOS interface + Hồng Tuyết` so the interface choice is preserved without keeping the temporary palette.
