import { FilingOptionsController } from '../features/bookmark-filing/options-controller';
import { createChromeBookmarkTreeAdapter } from '../infrastructure/bookmarks/chrome-bookmark-tree';
import { createChromeLocalFilingConfigurationStore } from '../infrastructure/storage/chrome-filing-configuration-store';

export function createFilingOptionsController(): FilingOptionsController {
  return new FilingOptionsController(
    createChromeLocalFilingConfigurationStore(),
    createChromeBookmarkTreeAdapter(),
  );
}
