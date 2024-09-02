import { exchangeBars, install } from '~/background/service.ts';
import { findFolder, getCustomDirectoryId } from '~/background/util.ts';
import { getActiveBar, getLastWorkspaceId, updateLastWorkspaceId } from '~/background/storage.ts';

type IdleState = chrome.idle.IdleState;

const SHORTCUT_DELAY = 100;
let MAIN_WINDOW_ID: number | undefined;
let currentIdleState: IdleState = 'active';

/**
 * Handle changes to bookmarks.
 *
 * @param _id - The bookmark id.
 * @param info - Info about the changed bookmark.
 */
export const handleChange = async (_id: string, info: { title: string; url?: string }) => {
    await waitForActiveIdleState();
    if (info.url !== undefined) {
        return;
    }
    await getCustomDirectoryId();
};

/**
 * Handle moving of bookmarks.
 *
 * @param id - The bookmark id.
 */
export const handleMove = async (id: string) => {
    await waitForActiveIdleState();
    const bookmark = await findFolder(id);
    if (bookmark === undefined) {
        return;
    }
    await getCustomDirectoryId();
};

/**
 * Handle removal of bookmarks.
 *
 * @param id - The bookmark id.
 * @param removeInfo - Info about the removed bookmark.
 */
export const handleRemove = async (id: string, removeInfo: { node: { title: string; url?: string } }) => {
    await waitForActiveIdleState();
    if (removeInfo.node.url !== undefined) {
        return;
    }
    const customDirectoryId = await getCustomDirectoryId();
    if (id === customDirectoryId) {
        await install();
        return;
    }

    await getActiveBar();
};

/**
 * Handle the switching of workspaces on Opera browser.
 * Switches to the active bar of the selected workspace
 * and updates the value of 'lastWorkspaceId'.
 *
 * @param _info - Info about the activated tab.
 */
export const handleWorkspaceSwitch = async (_info: chrome.tabs.TabActiveInfo) => {
    await waitForActiveIdleState();
    if (MAIN_WINDOW_ID !== _info.windowId) {
        console.log('Tab is not in mainWindow. Do not chaning Bar.', MAIN_WINDOW_ID, _info.windowId);
        return;
    }
    const lastWorkspaceId = await getLastWorkspaceId();
    const currentBar = await getActiveBar();
    const lastActiveBar = await getActiveBar(lastWorkspaceId);
    await exchangeBars(currentBar.title, lastActiveBar.title);
    await updateLastWorkspaceId();
};

/**
 * Handles the creation of a new Browser window.
 * If it is the first created normal window, it sets it as the main window.
 *
 * @param window - The newly created window object.
 */
export const handleWindowCreate = (window: chrome.windows.Window) => {
    console.log('MAIN_WINDOW_ID', MAIN_WINDOW_ID, 'currentWindowId', window.id);
    if (window.id && MAIN_WINDOW_ID === undefined && window.type === 'normal') {
        MAIN_WINDOW_ID = window.id;
        console.log('Setting mainWindowId:', MAIN_WINDOW_ID);
    } else {
        console.log('Main Window is already set.');
    }
};

/**
 * Handle switching of bookmark bars by shortcuts.
 *
 * @param command - The shortcut command to be handled.
 */
export const handleShortcut = debounce(async (command: string) => {
    await waitForActiveIdleState();
    const getNext = command === 'next-bar';
    const customDirectoryId = await getCustomDirectoryId();
    const activeBar = await getActiveBar();
    const bookmarks = await chrome.bookmarks.getChildren(customDirectoryId);
    const bookmarksBars = bookmarks.filter((bar) => !bar.url);

    if (bookmarksBars.length === 0) {
        return;
    }

    if (/^switch-to-[1-9]$/u.test(command)) {
        const index = Number(command.split('-')[2]) - 1;
        const activatedTitle = bookmarksBars[index] ? bookmarksBars[index].title : bookmarksBars[0].title;
        await exchangeBars(activatedTitle);
        return;
    }

    let activatedTitle;
    const activeBarIndex = bookmarksBars.map((b) => b.id).indexOf(activeBar.id);
    if (getNext) {
        activatedTitle = bookmarksBars[activeBarIndex + 1]
            ? bookmarksBars[activeBarIndex + 1].title
            : bookmarksBars[0].title;
    } else {
        activatedTitle = bookmarksBars[activeBarIndex - 1]
            ? bookmarksBars[activeBarIndex - 1].title
            : bookmarksBars.at(-1)?.title;
    }
    await exchangeBars(activatedTitle ?? '');
}, SHORTCUT_DELAY);

/**
 * Handle idle state changes.
 */
export const handleIdle = (idleState: IdleState) => {
    currentIdleState = idleState;
    console.log('Idle state changed to:', idleState);
};

/**
 * Block until the idle state is active.
 *
 * @returns - A promise that resolves when the idle state is active.
 */
export function waitForActiveIdleState(): Promise<void> {
    return new Promise((resolve) => {
        const checkIdleState = () => {
            if (currentIdleState === 'active') {
                resolve();
            } else {
                // Check every second
                setTimeout(checkIdleState, 1000);
            }
        };
        checkIdleState();
    });
}
/**
 * Introduce a delay between shortcuts to avoid exceeding the MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE.
 *
 * @param func - The function handling the shortcut.
 * @param delay - The delay in milliseconds.
 * @returns - The function handling the shortcut with the introduced delay.
 */
function debounce(func: (command: string) => Promise<void>, delay: number) {
    let timerId: NodeJS.Timeout | undefined;
    return function (...args: [string]) {
        if (timerId) {
            clearTimeout(timerId);
        }
        timerId = setTimeout(async () => {
            await func(...args);
            timerId = undefined;
        }, delay);
    };
}
