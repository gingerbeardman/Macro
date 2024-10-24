**Macro** provides recording and replay of text editing changes.

Capture typing, text modification, selections, and cursor movement made during an editing session.

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

Last Macro refers to the one most recently recorded—the one at the bottom of the list.


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
- DEL (deletion)
- POS (cursor position, +/-)
- SEL (selection, +/-)
- REP (replace selected text)

In addition to this, each macro stores its own expanded/unexpanded state for the sidebar.

### Example Macro

Raw macro (17 actions):
```
{"name":"Macro 1","actions":[{"type":"INS","text":"N"},{"type":"INS","text":"o"},{"type":"INS","text":"o"},{"type":"INS","text":"n"},{"type":"POS","direction":"←","count":1},{"type":"POS","direction":"←","count":1},{"type":"DEL","count":1},{"type":"DEL","count":1},{"type":"INS","text":"v"},{"type":"INS","text":"a"},{"type":"INS","text":"!"},{"type":"DEL","count":-1},{"type":"DEL","count":-1},{"type":"DEL","count":-1},{"type":"DEL","count":-1},{"type":"INS","text":"O"},{"type":"INS","text":"V"},{"type":"INS","text":"A"},{"type":"INS","text":"!"},{"type":"POS","direction":"←","count":1},{"type":"SEL","count":-1,"start":3,"end":4,"forward":false},{"type":"SEL","count":-2,"start":2,"end":4,"forward":false},{"type":"SEL","count":-3,"start":1,"end":4,"forward":false},{"type":"REP","old":"OVA","new":"o"},{"type":"INS","text":"v"},{"type":"INS","text":"a"}],"isExpanded":false}
```
Compressed macro (6 actions):
```
[{"type":"INS","text":"Noon"},{"type":"POS","direction":"←","count":2},{"type":"DEL","count":2},{"type":"INS","text":"va!"},{"type":"DEL","count":-4},{"type":"INS","text":"OVA!"},{"type":"POS","direction":"←","count":1},{"type":"SEL","count":-3,"start":1,"end":4,"forward":false},{"type":"REP","old":"OVA","new":"o"},{"type":"INS","text":"va"}]
```

This types:

- Noon<move left 2><delete 2>va!<delete -4>OVA!<move left 1><select -3><replace "OVA" → "o">va
