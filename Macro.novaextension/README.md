**Macro** provides recording and playback of editor changes.

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

- Toggle Macro Recording (`Option`+`Cmd`+`m`)
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
- Copy (to Clipboard)
- Delete


## Recording

A notification will signal recording has begun. When done, you select the Stop button in the notification and the macro will be automatically saved to the sidebar.

You can also start the recording using the sidebar icons, or command, but it will always need to be stopped through the notification.

After recording you can choose to replay, compress, copy, delete, etc. each macro.

### Actions

The following actions are recorded:

- INS (insert text)
- DEL (delete text)
- POS (cursor position)
- SEL (selected text)
- REP (replace selected text)

In addition to this, each macro stores its own expanded/unexpanded state for the sidebar.

### Example Macro

Raw macro (17 actions):
```
{"name":"Macro 1","actions":[{"type":"INS","text":"N"},{"type":"INS","text":"o"},{"type":"INS","text":"o"},{"type":"INS","text":"n"},{"type":"DEL","count":1},{"type":"DEL","count":1},{"type":"INS","text":"v"},{"type":"INS","text":"a"},{"type":"INS","text":"!"},{"type":"SEL","start":-1,"end":0},{"type":"SEL","start":-2,"end":0},{"type":"SEL","start":-3,"end":0},{"type":"SEL","start":-4,"end":0},{"type":"SEL","start":-5,"end":0},{"type":"REP","old":"Nova!","new":":"},{"type":"INS","text":")"},{"type":"INS","text":"\n"}],"isExpanded":true}
```
Compressed macro (6 actions):
```
{"name":"Macro 1 (Copy)","actions":[{"type":"INS","text":"Noon"},{"type":"DEL","count":2},{"type":"INS","text":"va!"},{"type":"SEL","start":-5,"end":0},{"type":"REP","old":"Nova!","new":":"},{"type":"INS","text":")\n"}],"isExpanded":true}
```

This types:

- Noon<delete -2>va!<select -5>:)\\n
