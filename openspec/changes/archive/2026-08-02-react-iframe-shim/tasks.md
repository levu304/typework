## 1. Scaffold package
- [x] 1.1 Create `packages/react-viewer` workspace package (package.json, tsconfig.json, README.md)
- [x] 1.2 Install devDeps (`typescript`, `@types/react`); approve esbuild build (pnpm 11 quirk)

## 2. Implement component
- [x] 2.1 Author `SpreadsheetViewer` (`src/index.tsx`): extends IframeHTMLAttributes, requires `src`, forwards rest, defaults `title`
- [x] 2.2 Set displayName `SpreadsheetViewer`

## 3. Verify
- [x] 3.1 `tsc -p .` compiles; emits `dist/index.{js,d.ts,js.map}`
- [x] 3.2 `openspec validate --change react-iframe-shim` passes (1 passed, 0 failed)
