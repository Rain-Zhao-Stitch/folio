Folio · Three.js Local Reader

Double-click 启动阅读器.cmd, or run node server.cjs in this directory, then open [http://127.0.0.1:4173](http://127.0.0.1:4173). Node.js must be installed. Closing the command window will stop the server. All web dependencies are stored locally in dist/vendor, so no internet connection is required during use.

After importing an EPUB, click the book cover to start reading. Use the arrows on both sides, the left and right arrow keys, or horizontal swipe gestures to turn pages. The Table of Contents button lets you switch chapters. The Aa menu allows you to import TTF, OTF, WOFF, or WOFF2 fonts and adjust the font size. The top toolbar includes a dark mode toggle. Desktop devices automatically use a two-page layout, while smaller screens use a single-page layout.

The Aa settings also include Comic Sans MS, line spacing, letter spacing, word spacing, page margins, and paragraph spacing. Before these spacing settings are manually changed, the reader uses the original EPUB styles. Once changed, the settings are saved locally together with other reader preferences. Comic Sans MS uses the version installed on the computer. Chinese characters that are not supported by the font will use the system fallback font. If Comic Sans MS is not installed, it must be installed or imported manually.

The fullscreen button in the reading toolbar enters a clean reading mode. Press Esc to exit fullscreen. Fullscreen mode hides the toolbar, page-turn buttons, and popups, while keeping the current page number visible at the bottom. The book pages expand to fill the screen while keeping the current font and spacing settings.

Before entering or leaving fullscreen mode, the reader records the EPUB CFI of the first visible line and realigns the new layout to the same content instead of estimating the position using the old page number. In fullscreen mode, pages can still be turned using the left and right arrow keys, swipe gestures, or dragging from the page edges. Dark mode uses a pure black background with white text.

Original EPUB files, book covers, reading positions, imported fonts, and settings are stored in the browser's IndexedDB. Always use the fixed address [http://127.0.0.1:4173](http://127.0.0.1:4173) and the same browser. Different ports, localhost, and different browsers use separate storage. Clearing browser site data or using private or incognito mode may cause stored data to be lost. Always keep copies of the original EPUB and font files.

Two-finger horizontal trackpad gestures directly control page-curl progress based on the total swipe distance. The left and right arrow keys use the same vertical-spine page-curl animation.

Because browsers cannot directly detect when fingers leave the trackpad, the reader uses a short period without input to determine when the gesture has ended. If the page curl passes 50 percent before the gesture ends, the page turn completes. If it is at or below 50 percent, the page returns to its original position. Press Esc to cancel the gesture.

Each gesture can turn at most one page. Vertical scrolling and zoom gestures do not trigger page turns. The draggable page-edge area is between 40 and 100 pixels wide.

After a page turn finishes, the next GPU page surface in the same direction is preloaded whenever possible. If another swipe begins before the previous gesture has fully ended, a short pause followed by renewed movement is detected and queued as the next page turn.

Continuous swiping still plays the full page-curl animation and does not fall back to a black edge or fade transition. When a page is loaded for the first time or the cache has been invalidated, the current page remains at normal brightness until the required snapshot is ready.

The Translation Settings button in the upper-right corner allows you to configure translation shortcuts and definition language. By default, double-click an English word and press Alt + T to display its Chinese part of speech and definition below the selected word. English definitions can also be selected.

The language settings also allow you to import dictionaries in JSON, CSV, TSV, or tab-separated TXT format. UTF-8, UTF-16, and common Windows GB18030 encodings are supported. Imported dictionaries are stored locally and take priority over the built-in dictionary.

JSON dictionaries may use this structure:

{"word":{"zh":"Chinese definition","en":"English definition"}}

Tabular dictionary files should use three columns:

word / zh / en

Invalid dictionary files will not overwrite the currently loaded dictionary. Imported dictionaries can be removed at any time to return to the built-in ECDICT dictionary.

Keyboard shortcuts may include punctuation combinations such as Alt + comma. Mouse side button 1 or 2 can also be assigned directly to dictionary lookup. When Double-click to Translate is enabled, double-clicking a word immediately shows its definition without requiring a shortcut.

The definition popup uses a semi-transparent background, background blur, and highlighted borders. Translation shortcuts continue to work in fullscreen mode.

The built-in dictionary uses a local copy of ECDICT containing 768,739 entries. Dictionary files are stored in dist/dictionary and are loaded in word-based chunks. No internet connection is required, and selected text is never sent anywhere.

The dictionary data comes from:
[https://github.com/skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)

The MIT license and the SHA-256 hash of the original source files are stored together with the dictionary. If a word is not found, the reader clearly reports that no definition was found instead of generating or guessing one.

Page turning has been rewritten using Three.js and WebGL2. Arrow keys, page buttons, and trackpad gestures all use the same GPU-rendered page surface that curls parallel to the book spine.

When the mouse grabs any point along the page edge, that exact point becomes the paper anchor. The fold line is calculated as the perpendicular bisector between the anchor point and the current pointer position, so the fold always remains perpendicular to the dragging direction.

After the GPU animation finishes, the rendered page briefly crossfades into the fully laid-out EPUB content to prevent visual flickering between the texture and the static DOM.

The paper surface is always opaque and writes to the depth buffer. Front and back page textures are generated from the actual EPUB.js layout instead of DOM slicing or StPageFlip.

Only one WebGL context is used. Front and back page textures are pre-uploaded. Rendering stops when animation progress does not change. Textures and meshes are released when the cache becomes invalid. When the reader is idle, the original selectable DOM text remains active.

This implementation is designed to approximate the page-curl behavior of iBooks. It does not reproduce Apple's original animation.

If Reduce Motion is enabled or WebGL is unavailable, the reader falls back to a standard page transition.

If the translation popup is already open, pressing the assigned keyboard shortcut or mouse side button again closes it.

JoyXoff system-level mouse mapping is controlled entirely by JoyXoff. The web application cannot override JoyXoff's rule that automatically disables mappings in fullscreen mode. To prevent this, configure the corresponding browser profile in JoyXoff so that it remains enabled during fullscreen mode.

Direction keys or shoulder buttons received directly by the web page can still turn pages. This does not mean the system mouse cursor mapping has been restored.

The A button does not trigger an additional page turn in the browser to avoid conflicts when it is mapped to a mouse click.

Compatibility includes EPUB 2 and EPUB 3 through EPUB.js. The reader preserves the book's HTML, CSS, images, and Table of Contents.

Perfect rendering of every EPUB cannot be guaranteed. DRM-protected EPUB files, malformed files, interactive scripts, synchronized audio or video, and complex fixed-layout publications may not be supported or may behave differently from other readers.

Scripts inside EPUB files are disabled. Unusual EPUB files should be tested individually.

Reader application code:
dist/app.js

Three.js rendering source:
src/curl.js

Translation code:
dist/translation.js

Styles:
dist/style.css

Run the following command to generate the offline bundle:

npm run build

The generated file is:

dist/curl.js

Run the following command to check the syntax of the entry scripts:

npm test

A web application was chosen instead of an Electron wrapper so the project can reuse the existing EPUB DOM layout and the browser's GPU rendering pipeline without adding another application layer.

This does not mean browser-based rendering will always be faster on every device.

In the future, the dist folder can be deployed to a static hosting service. However, books and settings stored locally will not automatically transfer to a different website address.

Dependencies:

EPUB.js - BSD-2-Clause

JSZip - MIT/GPL-3.0 dual license, using the MIT license

Three.js - MIT

esbuild - used for bundling

Old StPageFlip files remain in vendor for reference to previous implementations, but the current version no longer loads or depends on StPageFlip.

To verify the project, run:

npm run build
npm test
npm run verify

The final command automatically reuses an existing local server or starts one if necessary, then runs all verify*.cjs tests in sequence.

Testing uses headless Microsoft Edge and custom EPUB test files.

The tests cover EPUB importing, forward and backward page turns, completed and cancelled drag gestures, Table of Contents navigation, font importing, dark mode, restoring the reading position after refresh, mobile layouts, Three.js texture pixel comparison, GPU resource cleanup, graphics-context loss and recovery, and continued reading when WebGL is unavailable.

Test screenshots are saved in:

test-results

These automated tests do not guarantee compatibility with every real EPUB file, physical trackpad, or game controller.
