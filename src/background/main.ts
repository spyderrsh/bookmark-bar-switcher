import {
    handleChange,
    handleIdle,
    handleMove,
    handleRemove,
    handleShortcut,
    handleWindowCreate,
    handleWorkspaceSwitch,
} from '~/background/handlers.ts';
import { install } from '~/background/service.ts';
import { isOperaBrowser } from './util.ts';

chrome.runtime.onInstalled.addListener(install);
chrome.bookmarks.onChanged.addListener(handleChange);
chrome.bookmarks.onRemoved.addListener(handleRemove);
chrome.bookmarks.onMoved.addListener(handleMove);
chrome.commands.onCommand.addListener(handleShortcut);
chrome.idle.onStateChanged.addListener(handleIdle);

// Initialize idle detection
// Set the idle detection interval to 15 seconds
chrome.idle.setDetectionInterval(15);
if (isOperaBrowser()) {
    // Saves windowId, so Workspace don't switch on new opened windows
    chrome.windows.onCreated.addListener(handleWindowCreate);
    // An onActivated event is fired on every workspace switch
    chrome.tabs.onActivated.addListener(handleWorkspaceSwitch);
}
