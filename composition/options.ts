import { FilingOptionsController } from '../features/bookmark-filing/optionsController';
import { createChromeBookmarkTreeAdapter } from '../infrastructure/bookmarks/chromeBookmarkTree';
import { createChromeLocalFilingConfigurationStore } from '../infrastructure/storage/chromeFilingConfigurationStore';

export function createFilingOptionsController(): FilingOptionsController {
  return new FilingOptionsController(
    createChromeLocalFilingConfigurationStore(),
    createChromeBookmarkTreeAdapter(),
  );
}
