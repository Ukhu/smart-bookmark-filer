import { createFilingWorkflow } from '../composition/background';
import { registerBookmarkCreatedListener } from '../features/bookmark-filing/bookmarkCreatedListener';

export default defineBackground(() => {
  registerBookmarkCreatedListener(
    browser.bookmarks.onCreated,
    createFilingWorkflow(),
  );
});
