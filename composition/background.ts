import { DestinationCandidateBuilder } from '../features/bookmark-filing/candidateBuilder';
import { FilingWorkflow } from '../features/bookmark-filing/filingWorkflow';
import { createChromeBookmarkTreeAdapter } from '../infrastructure/bookmarks/chromeBookmarkTree';
import { OpenAiResponsesClassifier } from '../infrastructure/openai/openAiResponsesClassifier';
import { createChromeLocalFilingConfigurationStore } from '../infrastructure/storage/chromeFilingConfigurationStore';
import { createChromeLocalFilingActivityStore } from '../infrastructure/storage/chromeFilingActivityStore';

export function createFilingWorkflow(): FilingWorkflow {
  const bookmarks = createChromeBookmarkTreeAdapter();

  return new FilingWorkflow({
    configuration: createChromeLocalFilingConfigurationStore(),
    bookmarks,
    folderTree: bookmarks,
    candidateBuilder: new DestinationCandidateBuilder(bookmarks),
    classifier: new OpenAiResponsesClassifier(),
    activity: createChromeLocalFilingActivityStore(),
  });
}
