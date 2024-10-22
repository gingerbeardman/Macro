let recordSelectionActions = nova.config.get('com.gingerbeardman.Macro.recordSelectionActions') || true;
let compressMacro = nova.config.get('com.gingerbeardman.Macro.compressMacro') || false;
let debugEnabled = nova.config.get('com.gingerbeardman.Macro.debugLogs') || false;
let slowPlaybackSpeed = nova.config.get('com.gingerbeardman.Macro.slowPlaybackSpeed') || "10";

class MacroSystem {
    constructor() {
        this.macros = [];
        this.isRecording = false;
        this.currentMacro = [];
        this.lastRecordedState = null;
    }

    captureEditorState() {
        let editor = nova.workspace.activeTextEditor;
        return editor ? {
            text: editor.getTextInRange(new Range(0, editor.document.length)),
            selectedRange: editor.selectedRange,
            cursorPosition: editor.selectedRange.end
        } : null;
    }

    startRecording() {
        this.isRecording = true;
        this.currentMacro = [];
        this.lastRecordedState = this.captureEditorState();
        this.showRecordingNotification();
    }

    stopRecording() {
        this.isRecording = false;
        if (this.currentMacro.length > 0) {
            let finalMacro = nova.config.get('com.gingerbeardman.Macro.compressMacro') 
                ? this.coalesceActions(this.currentMacro) 
                : this.currentMacro;
            let nextMacroName = "Macro " + (this.macros.length + 1);
            this.macros.push({
                name: nextMacroName,
                actions: finalMacro,
                isExpanded: false
            });
            this.saveMacros();
            macrosView.reload();
        }
        nova.notifications.cancel("macro-recording-started");
    }

    recordAction() {
        if (!this.isRecording) return;
        
        let currentState = this.captureEditorState();
        if (!currentState || !this.lastRecordedState) {
            this.lastRecordedState = currentState;
            return;
        }

        let derivedAction = this.deriveAction(this.lastRecordedState, currentState);
        if (derivedAction) {
            this.currentMacro.push(derivedAction);
            debug(`Recorded action: ${JSON.stringify(derivedAction)}`);
        }
        this.lastRecordedState = currentState;
    }

    getCommonPrefixLength(str1, str2) {
        let i = 0;
        while (i < str1.length && i < str2.length && str1[i] === str2[i]) i++;
        return i;
    }

    getCommonSuffixLength(str1, str2) {
        let i = 0;
        while (i < str1.length && i < str2.length && str1[str1.length - 1 - i] === str2[str2.length - 1 - i]) i++;
        return i;
    }

     deriveAction(lastState, currentState) {
        debug('Deriving action:', JSON.stringify({
            lastState: JSON.stringify({
                cursorPosition: lastState.cursorPosition,
                selectedRange: lastState.selectedRange,
                textLength: lastState.text.length
            }),
            currentState: JSON.stringify({
                cursorPosition: currentState.cursorPosition,
                selectedRange: currentState.selectedRange,
                textLength: currentState.text.length
            })
        }));

        let action = null;

        // Check for text changes
        if (lastState.text !== currentState.text) {
            let commonPrefixLength = this.getCommonPrefixLength(lastState.text, currentState.text);
            let commonSuffixLength = this.getCommonSuffixLength(
                lastState.text.slice(commonPrefixLength), 
                currentState.text.slice(commonPrefixLength)
            );
            
            let deletedText = lastState.text.slice(commonPrefixLength, lastState.text.length - commonSuffixLength);
            let insertedText = currentState.text.slice(commonPrefixLength, currentState.text.length - commonSuffixLength);
            
            if (deletedText.length > 0 && insertedText.length > 0) {
                action = { 
                    type: "REP", 
                    old: deletedText, 
                    new: insertedText
                };
            } else if (deletedText.length > 0) {
                // Use positive count for forward deletion, negative for backward
                const isForwardDelete = lastState.cursorPosition === currentState.cursorPosition;
                const count = deletedText.length * (isForwardDelete ? 1 : -1);
                action = { 
                    type: "DEL", 
                    count: count
                };
            } else if (insertedText.length > 0) {
                action = { 
                    type: "INS", 
                    text: insertedText 
                };
            }
        }
        // Check for cursor movements
        else if (lastState.cursorPosition !== currentState.cursorPosition) {
            let lineDelta = this.getLineDelta(lastState.text, lastState.cursorPosition, currentState.cursorPosition);
            let columnDelta = this.getColumnDelta(lastState.text, lastState.cursorPosition, currentState.cursorPosition);

            if (lineDelta !== 0) {
                action = { type: "POS", direction: lineDelta > 0 ? "↓" : "↑", count: Math.abs(lineDelta) };
            } else if (columnDelta !== 0) {
                action = { type: "POS", direction: columnDelta > 0 ? "→" : "←", count: Math.abs(columnDelta) };
            }
        }
        // Check for selection changes
        else if (!this.areRangesEqual(lastState.selectedRange, currentState.selectedRange)) {
            if (nova.config.get('com.gingerbeardman.Macro.recordSelectionActions')) {
                console.log("record SEL");
                // Store selection relative to cursor position
                action = { 
                    type: "SEL", 
                    count: currentState.selectedRange.start - lastState.cursorPosition
                };
            }
        }

        debug('Derived action:', JSON.stringify(action));
        return action;
    }

    getLineDelta(text, oldPos, newPos) {
        let oldLines = text.substring(0, oldPos).split('\n').length;
        let newLines = text.substring(0, newPos).split('\n').length;
        return newLines - oldLines;
    }

    getColumnDelta(text, oldPos, newPos) {
        let oldLineStart = text.lastIndexOf('\n', oldPos - 1) + 1;
        let newLineStart = text.lastIndexOf('\n', newPos - 1) + 1;
        let oldColumn = oldPos - oldLineStart;
        let newColumn = newPos - newLineStart;
        return newColumn - oldColumn;
    }

    areRangesEqual(range1, range2) {
        return range1.start === range2.start && range1.end === range2.end;
    }

    async executeMacro(macroName) {
        let macro = this.macros.find(m => m.name === macroName);
        if (!macro) {
            console.error(`Macro not found: ${macroName}`);
            return;
        }

        let editor = nova.workspace.activeTextEditor;
        if (!editor) {
            console.error("No active text editor");
            return;
        }

        for (let action of macro.actions) {
            await this.executeAction(editor, action);
            
            await this.delay(parseInt(nova.config.get('com.gingerbeardman.Macro.slowPlaybackSpeed')));
        }
    }

    async executeAction(editor, action) {
        if (!editor || !action) {
            console.error('Invalid editor or action', { editor, action });
            return;
        }

        debug('Executing action:', JSON.stringify(action));

        try {
            // Get current cursor position as base for relative operations
            const cursorPosition = editor.selectedRange.end;
            
            switch (action.type) {
                case "INS":
                    await editor.edit(edit => {
                        edit.insert(cursorPosition, action.text);
                    });
                    break;
                    
                case "DEL":
                    await editor.edit(edit => {
                        if (action.count > 0) {
                            // Forward deletion (Delete key)
                            edit.delete(new Range(cursorPosition, cursorPosition + action.count));
                        } else {
                            // Backward deletion (Backspace)
                            edit.delete(new Range(cursorPosition + action.count, cursorPosition));
                        }
                    });
                    break;
                    
                case "REP":
                    await editor.edit(edit => {
                        const replaceStart = cursorPosition - action.old.length;
                        edit.replace(new Range(replaceStart, cursorPosition), action.new);
                    });
                    break;
                    
                case "POS":
                    // Cancel any active selection by setting the cursor position explicitly
                    editor.selectedRange = new Range(cursorPosition, cursorPosition);
                    
                    for (let i = 0; i < action.count; i++) {
                        switch (action.direction) {
                            case "←":
                                await editor.moveLeft();
                                break;
                            case "→":
                                await editor.moveRight();
                                break;
                            case "↑":
                                await editor.moveUp();
                                break;
                            case "↓":
                                await editor.moveDown();
                                break;
                        }
                    }
                    break;
                    
                case "SEL":
                    // Calculate relative positions and ensure they don't go below 0
                    const basePosition = cursorPosition;
                    const relativeStart = Math.max(0, basePosition + action.count);
                    
                    // debug('Selection:', {
                    //     basePosition,
                    //     relativeStart,
                    //     docLength: editor.document.length
                    // });
                    
                    // Always select to current cursor position (end = basePosition)
                    const selStart = Math.min(relativeStart, editor.document.length);
                    editor.selectedRange = new Range(selStart, basePosition);
                    break;
             }
        } catch (error) {
            console.error('Error executing action', { action, error });
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    coalesceActions(actions) {
        return actions.reduce((coalesced, action) => {
            const lastAction = coalesced[coalesced.length - 1];

            if (!lastAction || lastAction.type !== action.type) {
                coalesced.push({...action});
            } else {
                switch (action.type) {
                    case "INS":
                        // Only coalesce consecutive insertions
                        if (!lastAction.text.includes('\n')) {
                            lastAction.text += action.text;
                        } else {
                            coalesced.push({...action});
                        }
                        break;
                    case "DEL":
                        // Only coalesce deletions in the same direction
                        if ((lastAction.count > 0) === (action.count > 0)) {
                            lastAction.count += action.count;
                        } else {
                            coalesced.push({...action});
                        }
                        break;
                    case "POS":
                        if (lastAction.direction === action.direction) {
                            lastAction.count += action.count;
                        } else {
                            coalesced.push({...action});
                        }
                        break;
                    case "SEL":
                        // Don't coalesce selections, just take the latest one
                        coalesced[coalesced.length - 1] = {...action};
                        break;
                    default:
                        coalesced.push({...action});
                }
            }
            return coalesced;
        }, []);
    }

    async replayMacro(name) {
        let macro = this.macros.find(m => m.name === name);
        if (macro) {
            await this.executeMacro(macro.actions);
        } else {
            nova.beep();
            debug("Macro not found: " + name);
        }
    }

    saveMacros() {
        nova.workspace.config.set("com.gingerbeardman.Macro", JSON.stringify(this.macros));
    }

    loadMacros() {
        let savedMacros = nova.workspace.config.get("com.gingerbeardman.Macro");
        if (savedMacros) {
            try {
                this.macros = JSON.parse(savedMacros);
                // Ensure each macro has an isExpanded property
                this.macros.forEach(macro => {
                    if (typeof macro.isExpanded === 'undefined') {
                        macro.isExpanded = false; // Default to collapsed
                    }
                });
            } catch (error) {
                console.error("Error parsing saved macros:", error);
                this.macros = [];
            }
        } else {
            this.macros = [];
        }
    }

    showRecordingNotification() {
        let request = new NotificationRequest("macro-recording-started");
        request.title = nova.localize("Macro");
        request.body = nova.localize("Recording...");
        request.actions = [nova.localize("Stop")];

        nova.notifications.add(request).then(
            (response) => {
                if (response.actionIdx === 0) {
                    this.stopRecording();
                }
            },
            (error) => {
                console.error("Error showing macro recording started notification:", error);
            }
        );
    }
}

class MacrosDataProvider {
    constructor(macroSystem) {
        this.macroSystem = macroSystem;
    }

    getChildren(element) {
        if (!element) {
            // Root level: return macro names
            return this.macroSystem.macros.map(m => m.name);
        } else {
            // Macro level: return actions
            let macro = this.macroSystem.macros.find(m => m.name === element);
            if (macro) {
                return macro.actions.map((action, index) => ({
                    ...action,
                    index: index,
                    macroName: macro.name
                }));
            }
        }
        return [];
    }

    getTreeItem(element) {
        if (typeof element === 'string') {
            // This is a macro name
            let macro = this.macroSystem.macros.find(m => m.name === element);
            if (!macro) return null;

            let item = new TreeItem(element, macro.isExpanded ? 
                TreeItemCollapsibleState.Expanded : 
                TreeItemCollapsibleState.Collapsed);

            // Add formatted version to tooltip
            const formatted = formatMacro(macro);
            item.tooltip = `${element} (${macro.actions.length} actions)\n\n${formatted.formatted}`;
            
            // Rest of the existing getTreeItem code...
            item.command = "com.gingerbeardman.Macro.replayMacro";
            item.contextValue = "macro";
            item.descriptiveText = `＝ ${macro.actions.length} actions`;
            item.image = "sidebar-list-item";

            return item;
        } else {
            // This is an action
            let actionDescription = this.getActionDescription(element);
            let actionType = actionDescription.slice(0, 3);
            let item = new TreeItem(actionDescription.slice(4), TreeItemCollapsibleState.None);
            item.contextValue = "action";
            item.tooltip = actionDescription;
            if (actionType == 'INS') {
                item.image = "sidebar-list-child-insert";
            } else if (actionType == 'REP') {
                item.image = "sidebar-list-child-replace";
            } else if (actionType == 'DEL') {
                item.image = "sidebar-list-child-delete";
            } else if (actionType == 'POS') {
                item.image = "sidebar-list-child-position";
            } else if (actionType == 'SEL') {
                item.image = "sidebar-list-child-selection";
            }

            return item;
        }
    }

    getActionDescription(action) {
        switch (action.type) {
            case "INS":
                if (action.text) {
                    let escapedText = this.escapeAndTruncate(action.text, 20);
                    return `INS ${escapedText}`;
                } else {
                    return `INS (details unavailable)`;
                }
            case "POS":
                if (action.direction && action.count) {
                    return `POS ${action.direction} ${action.count}`;
                } else {
                    return `POS (details unavailable)`;
                }
            case "REP":
                let escapedOld = this.escapeAndTruncate(action.old, 20);
                let escapedNew = this.escapeAndTruncate(action.new, 20);
                return `REP ${escapedOld} … ${escapedNew}`;
            case "SEL":
                if (action.count) {
                    return `SEL ${action.count}`;
                } else {
                    return `SEL (details unavailable)`;
                }
            case "DEL":
                if (action.count) {
                    return `DEL ${action.count}`;
                } else {
                    return `DEL (details unavailable)`;
                }
            default:
                return `ERR ${action.type}`;
        }
    }

    escapeAndTruncate(text, maxLength) {
        let escaped = text.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
        if (escaped.length > maxLength) {
            escaped = escaped.substring(0, maxLength) + "...";
        }
        return escaped;
    }
}

let macroSystem = new MacroSystem();
let macrosView;

function handleConfigChange() {
    recordSelectionActions = nova.config.get('com.gingerbeardman.Macro.recordSelectionActions') || true;
    compressMacro = nova.config.get('com.gingerbeardman.Macro.compressMacro') || false;
    slowPlaybackSpeed = nova.config.get('com.gingerbeardman.Macro.slowPlaybackSpeed') || "10";
    debugEnabled = nova.config.get('com.gingerbeardman.Macro.debugLogs') || false;
}

exports.activate = function() {
    debug('Macro extension activated');

    // Add config change listeners
    nova.config.onDidChange('com.gingerbeardman.Macro.recordSelectionActions', handleConfigChange);
    nova.config.onDidChange('com.gingerbeardman.Macro.compressMacro', handleConfigChange);
    nova.config.onDidChange('com.gingerbeardman.Macro.debug', handleConfigChange);
    nova.config.onDidChange('com.gingerbeardman.Macro.slowPlaybackSpeed', handleConfigChange);

    macroSystem.loadMacros();

    macrosView = new TreeView("com.gingerbeardman.Macro.sidebar", {
        dataProvider: new MacrosDataProvider(macroSystem)
    });

    nova.commands.register("com.gingerbeardman.Macro.toggleRecording", () => {
        if (macroSystem.isRecording) {
            macroSystem.stopRecording();
        } else {
            macroSystem.startRecording();
        }
    });
    nova.commands.register("com.gingerbeardman.Macro.startRecording", () => macroSystem.startRecording());
    nova.commands.register("com.gingerbeardman.Macro.stopRecording", () => macroSystem.stopRecording());
    nova.commands.register("com.gingerbeardman.Macro.replayMacro", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            macroSystem.executeMacro(selectedItems[0]);
        }
    });

    nova.subscriptions.add(macrosView);

    macrosView.onDidExpandElement((element) => {
        if (typeof element === 'string') {
            let macro = macroSystem.macros.find(m => m.name === element);
            if (macro) {
                macro.isExpanded = true;
                macroSystem.saveMacros();
            }
        }
    });

    macrosView.onDidCollapseElement((element) => {
        if (typeof element === 'string') {
            let macro = macroSystem.macros.find(m => m.name === element);
            if (macro) {
                macro.isExpanded = false;
                macroSystem.saveMacros();
            }
        }
    });

    nova.workspace.onDidAddTextEditor((editor) => {
        editor.onDidStopChanging(() => {
            if (macroSystem.isRecording) {
                macroSystem.recordAction();
            }
        });
    
        editor.onDidChangeSelection(() => {
            if (macroSystem.isRecording) {
                macroSystem.recordAction();
            }
        });
    });
}

// Utility functions
function areSelectionsEqual(sel1, sel2) {
    return sel1.start === sel2.start && sel1.end === sel2.end;
}

// Additional commands
nova.commands.register("com.gingerbeardman.Macro.copyToClipboardRaw", (workspace) => {
    let selectedItems = macrosView.selection;
    if (selectedItems && selectedItems.length > 0) {
        copyToClipboardRaw(selectedItems[0]);
    }
});
nova.commands.register("com.gingerbeardman.Macro.copyToClipboardReadable", (workspace) => {
    let selectedItems = macrosView.selection;
    if (selectedItems && selectedItems.length > 0) {
        copyToClipboardReadable(selectedItems[0]);
    }
});

nova.commands.register("com.gingerbeardman.Macro.replayLastMacro", () => {
    if (macroSystem.macros.length > 0) {
        macroSystem.replayMacro(macroSystem.macros[macroSystem.macros.length - 1].name);
    } else {
        nova.beep();
        debug("No macros available to replay");
    }
});

nova.commands.register("com.gingerbeardman.Macro.removeMacro", (workspace) => {
    let selectedItems = macrosView.selection;
    if (selectedItems && selectedItems.length > 0) {
        removeMacro(selectedItems[0]);
    }
});

nova.commands.register("com.gingerbeardman.Macro.renameMacro", (workspace) => {
    let selectedItems = macrosView.selection;
    if (selectedItems && selectedItems.length > 0) {
        renameMacro(selectedItems[0]);
    }
});

nova.commands.register("com.gingerbeardman.Macro.duplicateMacro", (workspace) => {
    let selectedItems = macrosView.selection;
    if (selectedItems && selectedItems.length > 0) {
        duplicateMacro(selectedItems[0]);
    }
});

nova.commands.register("com.gingerbeardman.Macro.compressExistingMacro", (workspace) => {
    let selectedItems = macrosView.selection;
    if (selectedItems && selectedItems.length > 0) {
        compressExistingMacro(selectedItems[0]);
    }
});

// Additional utility functions
function copyToClipboardRaw(name) {
    let macro = macroSystem.macros.find(m => m.name === name);
    if (macro) {
        nova.clipboard.writeText(JSON.stringify(macro));
    } else {
        nova.beep();
        debug("Macro not found: " + name);
    }
}

function copyToClipboardReadable(name) {
    let macro = macroSystem.macros.find(m => m.name === name);
    if (macro) {
        nova.clipboard.writeText(formatMacroToString(macro));
    } else {
        nova.beep();
        debug("Macro not found: " + name);
    }
}

function removeMacro(name) {
    let index = macroSystem.macros.findIndex(m => m.name === name);
    if (index !== -1) {
        macroSystem.macros.splice(index, 1);
        macroSystem.saveMacros();
        macrosView.reload();
    } else {
        nova.beep();
        debug("Macro not found: " + name);
    }
}

function renameMacro(oldName) {
    let macro = macroSystem.macros.find(m => m.name === oldName);
    if (macro) {
        nova.workspace.showInputPanel("Enter new name for the macro:", {
            placeholder: oldName,
            value: oldName
        }, (newName) => {
            if (newName && newName !== oldName) {
                macro.name = newName;
                macroSystem.saveMacros();
                macrosView.reload();
            }
        });
    } else {
        nova.workspace.showErrorMessage("Macro not found: " + oldName);
    }
}

function duplicateMacro(macroName) {
    let originalMacro = macroSystem.macros.find(m => m.name === macroName);
    if (!originalMacro) {
        nova.workspace.showErrorMessage(`Macro not found: ${macroName}`);
        return;
    }

    let newName = `${macroName} (Copy)`;
    let counter = 1;
    while (macroSystem.macros.some(m => m.name === newName)) {
        counter++;
        newName = `${macroName} (Copy ${counter})`;
    }

    let newMacro = {
        name: newName,
        actions: JSON.parse(JSON.stringify(originalMacro.actions)),
        isExpanded: false
    };

    macroSystem.macros.push(newMacro);
    macroSystem.saveMacros();
    macrosView.reload();
}

function compressExistingMacro(macroName) {
    let macroIndex = macroSystem.macros.findIndex(m => m.name === macroName);
    if (macroIndex === -1) {
        nova.workspace.showErrorMessage(`Macro not found: ${macroName}`);
        return;
    }

    let macro = macroSystem.macros[macroIndex];
    let originalActionCount = macro.actions.length;
    let compressedActions = macroSystem.coalesceActions(macro.actions);
    let newActionCount = compressedActions.length;

    if (newActionCount < originalActionCount) {
        macro.actions = compressedActions;
        macroSystem.saveMacros();
        macrosView.reload();
    }
}

function formatMacroToString(macro) {
    if (!macro || !macro.actions) {
        return '(empty macro)';
    }

    return macro.actions.reduce((output, action) => {
        switch (action.type) {
            case "INS":
                // Escape special characters and represent whitespace clearly
                return output + escapeSpecialChars(action.text);
                
            case "DEL":
                return output + `<delete ${action.count}>`;
                
            case "POS":
                const arrow = {
                    "→": "right",
                    "←": "left",
                    "↑": "up",
                    "↓": "down"
                }[action.direction] || action.direction;
                return output + `<move ${arrow} ${action.count}>`;
                
            case "SEL":
                return output + `<select ${action.count}>`;
                
            case "REP":
                return output + `<replace "${escapeSpecialChars(action.old)}" → "${escapeSpecialChars(action.new)}">`;
                
            default:
                return output + `<unknown ${action.type}>`;
        }
    }, '');
}

function escapeSpecialChars(text) {
    if (!text) return '';
    
    return text
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/\s/g, (match) => {
            switch (match) {
                case ' ': return '␣';  // Space
                case '\f': return '\\f';
                default: return match;
            }
        });
}

// Convenience function to format an entire macro object
function formatMacro(macro) {
    if (!macro) return '(invalid macro)';
    
    return {
        name: macro.name,
        formatted: formatMacroToString(macro),
        actionCount: macro.actions?.length || 0
    };
}

// Don't forget to export the deactivate function
exports.deactivate = function() {
    // Clean up subscription
    if (nova.subscriptions) {
        nova.subscriptions.dispose();
    }
}

function debug(...args) {
    if (debugEnabled !== true) {
        return; // Exit if debugging is not enabled
    }

    const processArg = (arg) => {
        if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg, null, 2);
        }
        return arg;
    };

    const processedArgs = args.map(processArg);
    console.log(...processedArgs);
}
