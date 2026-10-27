import { createFilingOptionsController } from '../../composition/options';
import type { OptionsViewState } from '../../features/bookmark-filing/optionsController';

function element<T extends HTMLElement>(id: string): T {
  const found = document.querySelector<T>(`#${id}`);
  if (!found) throw new Error(`Missing options element: ${id}`);
  return found;
}

const form = element<HTMLFormElement>('filing-options-form');
const inboxSelect = element<HTMLSelectElement>('inbox-folder');
const destinationSelect = element<HTMLSelectElement>('destination-roots');
const modelInput = element<HTMLInputElement>('model');
const confidenceInput = element<HTMLInputElement>('confidence-threshold');
const apiKeyInput = element<HTMLInputElement>('api-key-replacement');
const apiKeyStatus = element<HTMLParagraphElement>('api-key-status');
const clearApiKeyButton = element<HTMLButtonElement>('clear-api-key');
const status = element<HTMLDivElement>('status');
const controller = createFilingOptionsController();

function option(
  value: string,
  label: string,
  selected: boolean,
): HTMLOptionElement {
  const result = document.createElement('option');
  result.value = value;
  result.textContent = label;
  result.selected = selected;
  return result;
}

function render(state: OptionsViewState): void {
  inboxSelect.replaceChildren(
    option('', 'Select an Inbox folder', state.inboxFolderId === ''),
    ...state.folders.map((folder) =>
      option(folder.id, folder.path, folder.id === state.inboxFolderId),
    ),
  );
  if (state.staleInboxFolderId !== null) {
    const staleOption = option(
      state.staleInboxFolderId,
      `Missing folder (${state.staleInboxFolderId})`,
      true,
    );
    staleOption.disabled = true;
    inboxSelect.append(staleOption);
  }

  const selectedRootIds = new Set(state.destinationRootIds);
  destinationSelect.replaceChildren(
    ...state.folders.map((folder) =>
      option(folder.id, folder.path, selectedRootIds.has(folder.id)),
    ),
  );
  for (const staleFolderId of state.staleDestinationRootIds) {
    const staleOption = option(
      staleFolderId,
      `Missing folder (${staleFolderId})`,
      true,
    );
    staleOption.disabled = true;
    destinationSelect.append(staleOption);
  }

  modelInput.value = state.model;
  confidenceInput.value = String(state.confidenceThreshold);
  apiKeyInput.value = '';
  apiKeyStatus.textContent = state.hasConfiguredApiKey
    ? 'An API key is configured. Leave the field blank to preserve it.'
    : 'No API key is configured.';
  clearApiKeyButton.disabled = !state.hasConfiguredApiKey;

  const staleMessages = [
    ...(state.staleInboxFolderId === null
      ? []
      : [`The saved Inbox folder ${state.staleInboxFolderId} is missing.`]),
    ...state.staleDestinationRootIds.map(
      (folderId) => `The saved destination folder ${folderId} is missing.`,
    ),
  ];
  status.className = staleMessages.length > 0 ? 'error' : '';
  status.textContent = staleMessages.join(' ');
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  status.className = '';
  status.textContent = 'Saving…';

  void controller
    .save({
      inboxFolderId: inboxSelect.value,
      destinationRootIds: Array.from(
        destinationSelect.selectedOptions,
        ({ value }) => value,
      ),
      model: modelInput.value,
      confidenceThreshold: confidenceInput.valueAsNumber,
      apiKeyReplacement: apiKeyInput.value,
    })
    .then((result) => {
      if (!result.ok) {
        status.className = 'error';
        status.textContent = result.errors.join(' ');
        return;
      }

      render(result.state);
      status.className = 'success';
      status.textContent = 'Settings saved. Automatic filing is ready.';
    })
    .catch(() => {
      status.className = 'error';
      status.textContent = 'Settings could not be saved.';
    });
});

clearApiKeyButton.addEventListener('click', () => {
  status.className = '';
  status.textContent = 'Clearing API key…';

  void controller
    .clearApiKey()
    .then((state) => {
      render(state);
      status.className = 'success';
      status.textContent = 'API key cleared. Automatic filing is inactive.';
    })
    .catch(() => {
      status.className = 'error';
      status.textContent = 'The API key could not be cleared.';
    });
});

void controller
  .load()
  .then(render)
  .catch(() => {
    status.className = 'error';
    status.textContent = 'Settings and bookmark folders could not be loaded.';
  });
