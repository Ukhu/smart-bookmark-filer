import {
  createBookmarkCaptureController,
  createFilingWorkflow,
} from '../composition/background';
import { registerActionClickListener } from '../features/bookmark-capture/actionClickListener';
import { registerBookmarkCreatedListener } from '../features/bookmark-filing/bookmarkCreatedListener';
import { createChromeActionFeedback } from '../infrastructure/action/chromeActionFeedback';

export default defineBackground(() => {
  registerActionClickListener(
    browser.action.onClicked,
    createBookmarkCaptureController(),
    createChromeActionFeedback(),
  );
  registerBookmarkCreatedListener(
    browser.bookmarks.onCreated,
    createFilingWorkflow(),
  );
});
