import { FilingOptionsController } from '../features/bookmark-filing/optionsController';
import { OptionsActivityController } from '../features/bookmark-filing/optionsActivityController';
import { createChromeBookmarkTreeAdapter } from '../infrastructure/bookmarks/chromeBookmarkTree';
import { createChromeLocalFilingActivityStore } from '../infrastructure/storage/chromeFilingActivityStore';
import { createChromeLocalFilingConfigurationStore } from '../infrastructure/storage/chromeFilingConfigurationStore';

export function createFilingOptionsController(): FilingOptionsController {
  return new FilingOptionsController(
    createChromeLocalFilingConfigurationStore(),
    createChromeBookmarkTreeAdapter(),
  );
}

export function createOptionsActivityController(): OptionsActivityController {
  return new OptionsActivityController(createChromeLocalFilingActivityStore());
}
