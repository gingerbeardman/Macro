**Macro** provides recording and replay of text editing changes.

Capture typing, text modification, selections, cursor movement, made during an editing session.

Useful to speed up repetitive edits, to play back text changes for the purposes of screen recordings.


## Usage

To run Macro:

- Select the **Editor → Macro** menu item; or
- Open the command palette and type `Macro`


## Configuration

To configure global preferences, open **Extensions → Extension Library...** then select Macros's **Settings** tab.

- Recording
  - Selection Changes
    - default: on
  - Automatically Compress Macro
    - default: off

- Playback
  - Playback Delay (milliseconds)
    - default: 10

- Developer
  - Show Debug Logs
    - default: off

## Commands

These can be summoned from the Editor meny, Command Palette, or by shortcut key:

- Start Recording (`Option`+`Cmd`+`m`)
- Replay Last Macro (`Shift`+`Cmd`+`m`)

Last Macro refers to the one at the bottom of the list, usually the most recently recorded or processed.


## Sidebar

- `>` Play selected macro (or double-click)
- `+` Start Recording Macro
- `-` Delete selected macro

### Context Menu

- Replay
- Compress
- Duplicate
- Rename
- Copy (Compressed)
- Copy (Raw)
- Copy (Readable)
- Delete


## Recording

Recording is done on-demand, only when you want it. A notification will signal recording has begun. When done, you select the Stop button in the notification and the macro will be automatically saved to the sidebar.

You can also start the recording using the + sidebar icon, or a command via the menu or command palette, but recording is always stopped through the notification.

After recording a macro a number of options become available via the context menu.

### Actions

The following actions are recorded:

- INS (insertion)
- DEL (deletion, +/-)
- POS (cursor position, +/-)
- SEL (selection, +/-)
- REP (replace selection)

In addition to this, each macro stores its own expanded/unexpanded state for the sidebar.

### Compression

Compression of a macro serves a few purposes:
- reduce size
- speed up playback
- increase readability


## Example Macro

Raw macro (17 actions):
```
{"name":"Macro 1","actions":[{"type":"INS","text":"N"},{"type":"INS","text":"o"},{"type":"INS","text":"v"},{"type":"INS","text":"a"},{"type":"INS","text":"!"},{"type":"POS","direction":"←","count":1},{"type":"SEL","count":-1,"start":3,"end":4},{"type":"SEL","count":-2,"start":2,"end":4},{"type":"SEL","count":-3,"start":1,"end":4},{"type":"REP","old":"ova","new":"O"},{"type":"INS","text":"V"},{"type":"INS","text":"A"},{"type":"POS","direction":"←","count":1},{"type":"POS","direction":"←","count":1},{"type":"POS","direction":"←","count":1},{"type":"DEL","count":1},{"type":"DEL","count":1},{"type":"DEL","count":1},{"type":"INS","text":"o"},{"type":"INS","text":"v"},{"type":"INS","text":"a"}],"isExpanded":false}
```
Compressed macro (6 actions):
```
[{"type":"INS","text":"Nova!"},{"type":"POS","direction":"←","count":1},{"type":"SEL","count":-3,"start":1,"end":4},{"type":"REP","old":"ova","new":"O"},{"type":"INS","text":"VA"},{"type":"POS","direction":"←","count":3},{"type":"DEL","count":3},{"type":"INS","text":"ova"}]
```

This types:

- Nova!<move left 1><select -3><replace "ova" → "O">VA<move left 3><delete 3>ova

Resulting in:

- Nova!
