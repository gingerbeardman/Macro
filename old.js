let compressMacro = nova.config.get('com.gingerbeardman.macros.compressMacro') || false;
let slowPlaybackEnabled = nova.config.get('com.gingerbeardman.macros.slowPlayback') || false;
let slowPlaybackSpeed = nova.config.get('com.gingerbeardman.macros.slowPlaybackSpeed') || "0";

var macros = [];
var isRecording = false;
var currentMacro = [];
var macrosView;

let lastText = "";
let lastSelection = new Range(0, 0);
let lastCursorPosition = 0;

class MacrosDataProvider {
    getChildren(element) {
        if (!element) {
            // Root level: return macro names
            return macros.map(m => m.name);
        } else {
            // Macro level: return actions
            let macro = macros.find(m => m.name === element);
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
            let macro = macros.find(m => m.name === element);
            if (!macro) {
                console.error("Macro not found for name:", element);
                return null;
            }

            let item = new TreeItem(element, macro.isExpanded ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed);
            item.command = "com.gingerbeardman.macros.replayMacro";
            item.contextValue = "macro";
            item.tooltip = `${element} (${macro.actions.length} actions)`;
            item.descriptiveText = `＝ ${macro.actions.length} actions`;
            item.image = "sidebar-list-item";

            return item;
        } else {
            // This is an action
            let actionDescription = this.getActionDescription(element);
            let actionType = actionDescription.slice(0,3);
            let item = new TreeItem(actionDescription.slice(4), TreeItemCollapsibleState.None);
            item.contextValue = "action";
            item.tooltip = actionDescription;
            if (actionType == 'INS') {
                item.image = "sidebar-list-child-insert";
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
                return `POS ${action.delta > 0 ? '+' : ''}${action.delta}`;
            case "SEL":
                return `SEL ${action.delta}`;
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

function handleConfigChange() {
    compressMacro = nova.config.get('com.gingerbeardman.macros.compressMacro') || false;
    slowPlaybackEnabled = nova.config.get('com.gingerbeardman.macros.slowPlayback') || false;
    slowPlaybackSpeed = nova.config.get('com.gingerbeardman.macros.slowPlaybackSpeed') || "0";
}

exports.activate = function() {
    // Add config change listeners
    nova.config.onDidChange('com.gingerbeardman.macros.compressMacro', handleConfigChange);
    nova.config.onDidChange('com.gingerbeardman.macros.slowPlayback', handleConfigChange);
    nova.config.onDidChange('com.gingerbeardman.macros.slowPlaybackSpeed', handleConfigChange);

    loadMacros();
    
    macrosView = new TreeView("com.gingerbeardman.macros.sidebar", {
        dataProvider: new MacrosDataProvider()
    });
    
    nova.commands.register("com.gingerbeardman.macros.toggleRecording", toggleRecording);
    nova.commands.register("com.gingerbeardman.macros.startRecording", startRecording);
    nova.commands.register("com.gingerbeardman.macros.stopRecording", stopRecording);
    nova.commands.register("com.gingerbeardman.macros.replayMacro", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            replayMacro(selectedItems[0]);
        }
    });
    nova.commands.register("com.gingerbeardman.macros.viewMacro", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            viewMacro(selectedItems[0]);
        }
    });
    nova.commands.register("com.gingerbeardman.macros.replayLastMacro", replayLastMacro);
    nova.commands.register("com.gingerbeardman.macros.removeMacro", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            removeMacro(selectedItems[0]);
        }
    });
    nova.commands.register("com.gingerbeardman.macros.renameMacro", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            renameMacro(selectedItems[0]);
        }
    });
    nova.commands.register("com.gingerbeardman.macros.duplicateMacro", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            duplicateMacro(selectedItems[0]);
        }
    });
    nova.commands.register("com.gingerbeardman.macros.compressExistingMacro", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            compressExistingMacro(selectedItems[0]);
        }
    });

    nova.commands.register("com.gingerbeardman.macros.toggleExpansion", (workspace) => {
        let selectedItems = macrosView.selection;
        if (selectedItems && selectedItems.length > 0) {
            toggleMacroExpansion(selectedItems[0]);
        }
    });

    nova.subscriptions.add(macrosView);

    macrosView.onDidExpandElement((element) => {
        if (typeof element === 'string') {
            let macro = macros.find(m => m.name === element);
            if (macro) {
                macro.isExpanded = true;
                saveMacros();
            }
        }
    });

    macrosView.onDidCollapseElement((element) => {
        if (typeof element === 'string') {
            let macro = macros.find(m => m.name === element);
            if (macro) {
                macro.isExpanded = false;
                saveMacros();
            }
        }
    });

    nova.workspace.onDidAddTextEditor((editor) => {
        editor.onDidChangeSelection(() => {
            if (isRecording) {
                let newSelection = editor.selectedRange;
                
                if (!areSelectionsEqual(newSelection, lastSelection)) {
                    let selectionDelta = newSelection.end - lastSelection.end;
                    if (selectionDelta !== 0) {
                        currentMacro.push({ type: "SEL", delta: selectionDelta });
                        console.log(`Recorded SEL: ${selectionDelta}`);
                    }
                }
                
                lastSelection = newSelection;
                lastCursorPosition = newSelection.end;
            }
        });
        
        editor.onDidChange(() => {
            if (isRecording) {
                let newText = editor.getTextInRange(new Range(0, editor.document.length));
                let newSelection = editor.selectedRange;
                
                // Check for deletion (including overwrite of selection)
                let deletedCount = Math.max(lastText.length - newText.length, lastSelection.end - lastSelection.start);
                if (deletedCount > 0) {
                    currentMacro.push({ type: "DEL", count: deletedCount });
                    console.log(`Recorded DEL: ${deletedCount}`);
                }
                
                // Check for insertion (including overwrite)
                if (newSelection.end > lastSelection.start) {
                    let insertedText = newText.slice(lastSelection.start, newSelection.end);
                    if (insertedText.length > 0) {
                        currentMacro.push({ type: "INS", text: insertedText });
                        console.log(`Recorded INS: ${insertedText}`);
                    }
                }
                
                lastText = newText;
                lastSelection = newSelection;
                lastCursorPosition = newSelection.end;
            }
        });
    });
}

function areSelectionsEqual(sel1, sel2) {
    return sel1.start === sel2.start && sel1.end === sel2.end;
}

function loadMacros() {
    let savedMacros = nova.workspace.config.get("com.gingerbeardman.macros");
    if (savedMacros) {
        try {
            macros = JSON.parse(savedMacros);
            // Ensure each macro has an isExpanded property
            macros.forEach(macro => {
                if (typeof macro.isExpanded === 'undefined') {
                    macro.isExpanded = false; // Default to collapsed
                }
            });
        } catch (error) {
            console.error("Error parsing saved macros:", error);
            macros = [];
        }
    } else {
        macros = [];
    }
}

function saveMacros() {
    nova.workspace.config.set("com.gingerbeardman.macros", JSON.stringify(macros));
}

function toggleMacroExpansion(macroName) {
    let macro = macros.find(m => m.name === macroName);
    if (macro) {
        macro.isExpanded = !macro.isExpanded;
        saveMacros();
        macrosView.reload();
    }
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    isRecording = true;
    currentMacro = [];
    lastCursorPosition = null;
    lastSelection = null;
    let editor = nova.workspace.activeTextEditor;
    if (editor) {
        lastCursorPosition = editor.selectedRange.start;
        lastSelection = editor.selectedRange;
    }
    
    // Notification code remains the same
    let request = new NotificationRequest("macro-recording-started");
    request.title = nova.localize("Macro");
    request.body = nova.localize("Recording...");
    request.actions = [nova.localize(" STOP ")];
    
    nova.notifications.add(request).then(
        (response) => {
            if (response.actionIdx === 0) {  // "Stop" action was clicked
                stopRecording();
            }
        },
        (error) => {
            console.error("Error showing macro recording started notification:", error);
        }
    );
}

function stopRecording() {
    isRecording = false;
    lastCursorPosition = null;
    lastSelection = null;
    if (currentMacro.length > 0) {
        let finalMacro = compressMacro ? coalesceActions(currentMacro) : currentMacro;
        let nextMacroName = "Macro " + (macros.length + 1);
        macros.push({ name: nextMacroName, actions: finalMacro, isExpanded: false });
        saveMacros();
        macrosView.reload();
    } else {
        console.log("No actions recorded in this macro.");
    }
}

function coalesceActions(actions) {
    return actions.reduce((coalesced, action) => {
        const lastAction = coalesced[coalesced.length - 1];
        
        if (!lastAction || lastAction.type !== action.type) {
            coalesced.push({...action});
        } else {
            switch (action.type) {
                case "INS":
                    lastAction.text += action.text;
                    break;
                case "DEL":
                    lastAction.count += action.count;
                    break;
                case "POS":
                    lastAction.delta += action.delta;
                    break;
                case "SEL":
                    coalesced[coalesced.length - 1] = {...action};
                    break;
            }
        }
        
        return coalesced;
    }, []);
}

async function replayLastMacro() {
    if (macros.length > 0) {
        await executeMacro(macros[macros.length - 1].actions);
    } else {
        nova.beep();
        console.log("No macros available to replay");
    }
}

async function replayMacro(name) {
    let macro = macros.find(m => m.name === name);
    if (macro) {
        await executeMacro(macro.actions);
    } else {
        nova.beep();
        console.log("Macro not found: " + name);
    }
}

async function viewMacro(name) {
    let macro = macros.find(m => m.name === name);
    if (macro) {
        nova.clipboard.writeText(JSON.stringify(macro));
        // nova.workspace.showInformativeMessage(JSON.stringify(macro));
    } else {
        nova.beep();
        console.log("Macro not found: " + name);
    }
}

function renameMacro(oldName) {
    let macro = macros.find(m => m.name === oldName);
    if (macro) {
        nova.workspace.showInputPanel("Enter new name for the macro:", {
            placeholder: oldName,
            value: oldName
        }, (newName) => {
            if (newName && newName !== oldName) {
                macro.name = newName;
                saveMacros();
                macrosView.reload();
            }
        });
    } else {
        nova.workspace.showErrorMessage("Macro not found: " + oldName);
    }
}

function compressExistingMacro(macroName) {
    let macroIndex = macros.findIndex(m => m.name === macroName);
    if (macroIndex === -1) {
        nova.workspace.showErrorMessage(`Macro not found: ${macroName}`);
        return;
    }

    let macro = macros[macroIndex];
    let originalActionCount = macro.actions.length;
    let compressedActions = coalesceActions(macro.actions);
    let newActionCount = compressedActions.length;

    if (newActionCount < originalActionCount) {
        macro.actions = compressedActions;
        saveMacros();
        macrosView.reload();
    }
}

function duplicateMacro(macroName) {
    let originalMacro = macros.find(m => m.name === macroName);
    if (!originalMacro) {
        nova.workspace.showErrorMessage(`Macro not found: ${macroName}`);
        return;
    }

    let newName = `${macroName} (Copy)`;
    let counter = 1;
    while (macros.some(m => m.name === newName)) {
        counter++;
        newName = `${macroName} (Copy ${counter})`;
    }

    let newMacro = {
        name: newName,
        actions: JSON.parse(JSON.stringify(originalMacro.actions)),
        isExpanded: false
    };

    macros.push(newMacro);
    saveMacros();
    macrosView.reload();
}

function removeMacro(name) {
    let index = macros.findIndex(m => m.name === name);
    if (index !== -1) {
        macros.splice(index, 1);
        saveMacros();
        macrosView.reload();
    } else {
        nova.beep();
        console.log("Macro not found: " + name);
    }
}

async function executeMacro(actions) {
    let editor = nova.workspace.activeTextEditor;
    if (!editor) {
        console.error("No active text editor");
        return;
    }

    let cursorPosition = editor.selectedRange.end;
    let selectionAnchor = cursorPosition;

    console.log("Starting macro execution");
    console.log(`Initial state: cursor=${cursorPosition}, anchor=${selectionAnchor}`);
    console.log(`Total actions: ${actions.length}`);

    for (let action of actions) {
        console.log(`\nExecuting action: ${JSON.stringify(action)}`);
        console.log(`Before: cursor=${cursorPosition}, anchor=${selectionAnchor}`);

        try {
            await editor.edit((edit) => {
                switch (action.type) {
                    case "INS":
                        let insertPosition = Math.min(selectionAnchor, cursorPosition);
                        if (selectionAnchor !== cursorPosition) {
                            let deleteRange = new Range(insertPosition, Math.max(selectionAnchor, cursorPosition));
                            console.log(`Deleting selection: ${deleteRange.start}-${deleteRange.end}`);
                            edit.delete(deleteRange);
                        }
                        console.log(`Inserting "${action.text.replace(/\n/g, '\\n')}" at position ${insertPosition}`);
                        edit.insert(insertPosition, action.text);
                        cursorPosition = insertPosition + action.text.length;
                        selectionAnchor = cursorPosition;
                        break;
                    case "DEL":
                        if (selectionAnchor !== cursorPosition) {
                            let deleteRange = new Range(Math.min(selectionAnchor, cursorPosition), Math.max(selectionAnchor, cursorPosition));
                            console.log(`Deleting selection: ${deleteRange.start}-${deleteRange.end}`);
                            edit.delete(deleteRange);
                            cursorPosition = deleteRange.start;
                            selectionAnchor = cursorPosition;
                        } else {
                            let startPosition = Math.max(0, cursorPosition - action.count);
                            let deleteRange = new Range(startPosition, cursorPosition);
                            console.log(`Deleting: ${deleteRange.start}-${deleteRange.end}`);
                            edit.delete(deleteRange);
                            cursorPosition = startPosition;
                            selectionAnchor = cursorPosition;
                        }
                        break;
                    case "SEL":
                        if (action.delta < 0) {
                            selectionAnchor = cursorPosition;
                            cursorPosition = Math.max(0, cursorPosition + action.delta);
                        } else {
                            cursorPosition = Math.min(editor.document.length, cursorPosition + action.delta);
                        }
                        console.log(`Selecting ${action.delta > 0 ? 'forward' : 'backward'} to ${cursorPosition}`);
                        break;
                    case "POS":
                        cursorPosition = Math.max(0, Math.min(editor.document.length, cursorPosition + action.delta));
                        selectionAnchor = cursorPosition;
                        console.log(`Moving cursor to ${cursorPosition}`);
                        break;
                }
            });

            console.log(`After: cursor=${cursorPosition}, anchor=${selectionAnchor}`);
            console.log(`Current text: "${editor.getTextInRange(new Range(0, editor.document.length)).replace(/\n/g, '\\n')}"`);

            // Update the editor's selection
            editor.selectedRange = new Range(Math.min(selectionAnchor, cursorPosition), Math.max(selectionAnchor, cursorPosition));

        } catch (error) {
            console.error(`Error executing action: ${error.message}`);
            console.error(error.stack);
        }
    }

    console.log("\nMacro execution completed");
    console.log(`Final text: "${editor.getTextInRange(new Range(0, editor.document.length)).replace(/\n/g, '\\n')}"`);
    console.log(`Final state: cursor=${cursorPosition}, anchor=${selectionAnchor}`);
}